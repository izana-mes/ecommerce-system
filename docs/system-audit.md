# System Audit Report

**Date**: 2026-08-09  
**Audit Scope**: Full repository audit of `ecommerce-system` codebase  
**Source of Truth**: Flyway migrations V1–V45, Spring Boot service implementations, docker-compose configurations, frontend API routes

---

## 1. Technology Stack

### Backend

| Component | Technology | Version / Notes |
|---|---|---|
| Framework | Spring Boot | Java, JPA + raw JdbcTemplate |
| Database | PostgreSQL | 16-alpine (45 Flyway migrations) |
| Cache | Redis | 7-alpine (Lettuce client) |
| Messaging | RabbitMQ | 3-management-alpine, topic exchange |
| Auth | JWT (HMAC-SHA256) | HttpOnly cookies, access + refresh tokens |
| Email | Gmail SMTP or Resend API | Configurable via `MAIL_PROVIDER` |
| Payments | MoMo, VNPAY, PayPal | External gateway integrations |
| Observability | OpenTelemetry, Prometheus | OTLP traces, `/actuator/prometheus` |
| AI/Chatbot | OpenAI-compatible API | Optional, disabled by default |

### Frontend / BFF

| Component | Technology | Notes |
|---|---|---|
| Framework | Next.js | App Router, `/app/api/` proxy routes |
| WebSocket | STOMP over SockJS | Authenticated with JWT on CONNECT |
| State | React / Next.js server components | — |

### MCP Server

| Component | Technology | Notes |
|---|---|---|
| Framework | Node.js / Express | Internal only, port 3100 |
| Role | Tool-call proxy | Wraps Spring Boot REST endpoints as MCP tools |

---

## 2. Authentication Architecture

### JWT Strategy

- **Access tokens**: Short-lived (default 15 minutes, `JWT_ACCESS_TOKEN_EXPIRATION_MS=900000`), issued as HttpOnly cookies
- **Refresh tokens**: Long-lived (default 14 days), stored **hashed** in `refresh_tokens` table, issued as HttpOnly cookies
- **JTI tracking**: On login and token refresh, the access token's JTI is stored in Redis with a TTL matching the token expiry. This enables immediate revocation without waiting for expiry.
- **Token rotation**: Refresh token rotation is implemented — old token is revoked and a new token issued on every refresh.
- **Fail-open configuration**: `JWT_REVOCATION_FAIL_CLOSED=false` by default. If Redis is unreachable during JTI check, revocation check is skipped and the request proceeds.

### Session Revocation

- **Single session logout**: Revokes the specific refresh token by value. Access token JTI remains in Redis until TTL expires naturally.
- **All sessions logout**: Revokes all refresh tokens for the user via `revokeRefreshToken(user, LOGOUT_ALL)`. On password reset, additionally calls `accessTokenRevocationService.revokeUserAccessTokens()` to invalidate all active JTIs in Redis.

### Abuse Protection

- `AuthAbuseProtectionService` rate-limits login attempts by email+IP.
- Failed attempts are recorded and trigger lockouts.
- Rate limit state is stored in Redis.

### OAuth2

- Google OAuth2 configured via `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_ID/SECRET`.
- Application starts if credentials are blank; OAuth routes will not function.

### WebSocket Authentication

- STOMP CONNECT frames are intercepted by `WebSocketJwtAuthChannelInterceptor`.
- JWT is extracted from the `Authorization` native header.
- JTI is checked against Redis for revocation.
- Sessions are registered in `WebSocketSessionRegistry` (email → sessionId mapping).

---

## 3. Payment Flow Analysis

### MoMo

- **Initiation**: USD amounts are converted to VND at a configurable rate (`MOMO_USD_TO_VND_RATE`, default 26,000). Signature is HMAC-SHA256 using `MOMO_SECRET_KEY`.
- **IPN verification**: Backend recomputes HMAC-SHA256 on IPN payload and compares against provided signature.
- **Amount validation**: `ipn.amount == order.total_amount × usdToVndRate` is checked.
- **Idempotency**: Uses `payment_webhook_events` table with `event_key = requestId` from MoMo. INSERT fails on duplicate → duplicate IPNs are safely ignored.
- **On success**: Updates payment and order status, confirms inventory reservation, redeems coupon, publishes notifications.

### VNPAY

- **Initiation**: Params sorted alphabetically, HMAC-SHA512 signed with `VNPAY_HASH_SECRET`. Amount multiplied by 100 for VNPAY format (VND in units of 1/100 đồng).
- **IPN verification**: Backend recomputes HMAC-SHA512 and returns VNPAY-specific response codes (`RspCode`).
- **Amount validation**: `vnp_Amount == order.total_amount × usdToVndRate × 100`.
- **Idempotency**: `event_key = vnp_TransactionNo`. VNPAY-specific response codes returned.
- **BFF role**: BFF validates return URL signature before forwarding to backend IPN endpoint.

### PayPal

- **Flow**: Client-side PayPal JS SDK. Backend creates PayPal order via REST API, client approves, backend captures.
- **Idempotency**: `event_key = captureId`.
- **No IPN/webhook from PayPal**: Flow is capture-driven, not webhook-driven.

---

## 4. Critical Bugs and Security Issues

### 🔴 BUG-001: PayPal Inventory Not Confirmed (Data Integrity)

**Severity**: Critical  
**Location**: [`PayPalPaymentServiceImpl.java`](../backend/src/main/java/com/example/shop/modules/payment/paypal/service/PayPalPaymentServiceImpl.java) — `triggerPostPaymentActions()` (lines 402–418)

**Description**: After a successful PayPal payment capture, `inventoryReservationService.confirmByOrderNumber()` is **never called**. For MoMo and VNPAY, this call transitions the inventory reservation from `ACTIVE → CONFIRMED` and moves stock from `reserved_stock → packed_stock`. Without this call:

1. The reservation remains in `ACTIVE` (pending) status.
2. The 5-second background scheduler (`runExpiry()`) finds the expired reservation.
3. Scheduler calls `releaseInternal()` which moves `reserved_stock → available_stock` and restores `Product.stockQuantity`.
4. Result: The order is marked paid but inventory shows the stock as available again — a sold item can be re-sold to another customer.

**Fix**: Add `inventoryReservationService.confirmByOrderNumber(orderNumber)` to `triggerPostPaymentActions()` in `PayPalPaymentServiceImpl`.

---

### 🟡 BUG-002: JWT Revocation Fail-Open Default

**Severity**: Medium  
**Location**: [`application.yml`](../backend/src/main/resources/application.yml) — `application.security.jwt.revocation.fail-closed: false`

**Description**: When `fail-closed=false`, if Redis is unreachable during the JTI revocation check, the request proceeds as if the token is valid. This means revoked access tokens (e.g., after logout or password reset) will be accepted during Redis downtime.

**Recommendation**: In production, evaluate setting `JWT_REVOCATION_FAIL_CLOSED=true`. Accept the trade-off: Redis downtime will cause API authentication failures, but prevents security bypass.

---

### 🟡 BUG-003: MoMo Amount Check Uses Floating-Point Comparison

**Severity**: Medium  
**Location**: `MomoPaymentServiceImpl.java` — IPN amount comparison

**Description**: The IPN amount from MoMo is a `long` (VND in whole units). The comparison against `order.total_amount × usdToVndRate` involves `BigDecimal` to `long` conversion. If the exchange rate changes between order creation and IPN processing (e.g., due to config change or race), the check will fail and legitimate payments will be rejected.

**Recommendation**: Store the expected VND amount at order initiation time and compare against that stored value, not a recomputed value.

---

### 🟡 OBS-001: Payment Idempotency Lock Released on Error

**Severity**: Medium  
**Location**: [`PayPalPaymentServiceImpl.java`](../backend/src/main/java/com/example/shop/modules/payment/paypal/service/PayPalPaymentServiceImpl.java) — `releaseIdempotencyLock()`

**Description**: If an error occurs during PayPal payment processing after the idempotency lock is acquired, `releaseIdempotencyLock()` deletes the `payment_webhook_events` record. This means a retry can re-enter the processing path, potentially causing double-processing if the original capture succeeded partially.

---

### 🟢 OBS-002: Order Delivery Reminder Table Not in Flyway Migrations

**Severity**: Low  
**Location**: `FulfillmentNotificationService.java` line 140 — references `order_delivery_reminders` table

**Description**: The scheduler inserts into `order_delivery_reminders (order_id, reminder_day)` but this table is not present in any of the 45 Flyway migration files (V1–V45). This will cause a runtime SQL error when the scheduler first tries to insert a delivery reminder.

**Status**: NEEDS VERIFICATION — table may exist outside the reviewed migrations or the feature may not be enabled in production.

---

## 5. Data Model Observations

### Dual Stock Tracking

Products have two stock representations:
1. `products.stock_quantity` — the application-facing "available to buy" quantity, decremented at reservation time
2. `inventories.*_stock` fields (available, reserved, packed, in_transit, returned, damaged) — the operational inventory system with full lifecycle

These two systems must be kept in sync. The inventory reservation service updates both, but direct product updates bypassing the inventory system could cause divergence.

### Optimistic Locking

`inventories` table has a `version` column (BIGINT) used for optimistic locking. `inventory_reservations` also has a `version` column.

### Inventory Reservation TTL

The default reservation TTL is 300 minutes (5 hours) as set by `ORDER_PAYMENT_TIMEOUT_MINUTES = 5 * 60` in `OrderServiceImpl.java`. This is a long window — customers have 5 hours to complete payment before stock is released.

---

## 6. Security Observations

### Cookie Configuration

```yaml
auth-cookie:
  access-name: access_token   # configurable
  refresh-name: refresh_token  # configurable
  same-site: Lax              # CSRF protection
  secure: true                # HTTPS only in production
  access-path: /              # access token sent on all requests
  refresh-path: /api/v1/auth  # refresh token only sent to auth endpoints
```

The `refresh-path` scoping is a good practice — it limits the refresh token transmission to only auth endpoints.

### HMAC Keys in Environment Variables

All payment gateway secrets (`MOMO_SECRET_KEY`, `VNPAY_HASH_SECRET`, `PAYPAL_CLIENT_SECRET`) are injected via environment variables. No secrets are hardcoded in source code.

### PostgreSQL Password via Docker Secret

In `docker-compose.prod.yml`, the PostgreSQL password is passed via Docker Secret (`postgres_password.txt`) using `POSTGRES_PASSWORD_FILE`, not an environment variable. This is a security best practice.

### Container Hardening

All application containers use `cap_drop: ALL`, `read_only: true`, `no-new-privileges: true`, and `pids_limit: 256`. This significantly reduces the attack surface.

---

## 7. Architecture Observations

### BFF Dual IPN Role

The Next.js BFF serves a dual role in payment processing:
1. **Client proxy**: Forwards client requests to the backend
2. **Signature verifier**: Validates payment gateway return URL signatures client-side (MoMo and VNPAY) using the gateway secrets loaded in the BFF environment
3. **IPN forwarder**: After validating the return URL, calls the backend IPN endpoint

This means gateway secrets must be available in both the backend (for IPN processing) and the BFF (for return URL verification).

### Cache Invalidation Pub/Sub

A Redis Pub/Sub channel (`cache:invalidate:all`) is used to broadcast cache invalidation across all backend instances. This is implemented via `CacheInvalidationSubscriber`. This supports multi-node deployments where each node has a local cache.

### MCP Server Role

The MCP Node.js server acts purely as a tool-call proxy. It does not have its own database or business logic. All tools delegate to the Spring Boot backend REST API via HTTP. It is only accessible internally on `app_net`.

### Observability

- Spring Actuator exposes `/health`, `/info`, `/prometheus`, `/metrics`
- OpenTelemetry traces sent to a Tempo endpoint (`OTEL_EXPORTER_OTLP_ENDPOINT`)
- Custom metrics for AI request latency, MCP tool execution latency, payment IPN processing latency

---

## 8. Summary of Issues

| ID | Severity | Area | Description |
|---|---|---|---|
| BUG-001 | 🔴 Critical | PayPal / Inventory | Inventory not confirmed after PayPal capture — stock silently restored |
| BUG-002 | 🟡 Medium | Auth / Security | JWT revocation fails open when Redis is down |
| BUG-003 | 🟡 Medium | MoMo / Payment | Amount comparison uses runtime-computed rate, not stored value |
| OBS-001 | 🟡 Medium | PayPal / Idempotency | Idempotency lock released on error, enabling retry re-entry |
| OBS-002 | 🟢 Low | Fulfillment | `order_delivery_reminders` table not in Flyway migrations |
