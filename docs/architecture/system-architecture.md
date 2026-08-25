# System Architecture Diagram

This document describes the physical system architecture based on the actual source code and configuration files.

Sources: [`docker-compose.prod.yml`](../../docker-compose.prod.yml), [`application.yml`](../../backend/src/main/resources/application.yml), [`mcp-server/src/index.ts`](../../mcp-server/src/index.ts).

## System Overview

```mermaid
graph TD
    Browser["🌐 Browser / Client"]
    ExtMoMo["💳 MoMo Gateway\nhttps://payment.momo.vn"]
    ExtVNPAY["💳 VNPAY Gateway\nexternal"]
    ExtPayPal["💳 PayPal API\napi.paypal.com"]
    ExtEmail["📧 Email Provider\nGmail SMTP or Resend API"]
    ExtAI["🤖 AI API\nOpenAI compatible endpoint"]
    ExtOTEL["📊 OpenTelemetry Collector\nTempo endpoint"]

    subgraph "Edge Layer"
        Frontend["Next.js BFF\nPort 3000\nHTTP + WebSocket proxy\nCookies, auth forwarding"]
    end

    subgraph "Application Layer"
        Backend["Spring Boot Backend\nPort 8080\nREST API + WebSocket (STOMP)\nJWT auth, business logic"]
        MCP["MCP Node.js Server\nPort 3100 (internal only)\nTool-call proxy to Backend API"]
    end

    subgraph "Data Layer"
        Postgres["PostgreSQL 16\nPort 5432 (internal)\nPrimary data store\n45+ tables via Flyway"]
        Redis["Redis 7\nPort 6379 (internal)\nJWT revocation JTI store\nCache (products, dashboards)\nPub/Sub: cache:invalidate:all\nDistributed inventory locks\nRate limiting"]
        RabbitMQ["RabbitMQ 3\nPort 5672/15672 (internal)\nExchange: shop.events\n10+ queues with DLQs"]
    end

    Browser -- "HTTP / WebSocket" --> Frontend
    Frontend -- "HTTP API calls\n(server-side proxy)" --> Backend
    Frontend -- "WebSocket STOMP upgrade" --> Backend

    Backend -- "JDBC/JPA" --> Postgres
    Backend -- "Redis client\n(Lettuce)" --> Redis
    Backend -- "AMQP" --> RabbitMQ
    Backend -- "HTTP REST" --> MCP
    Backend -- "SMTP / Resend HTTP" --> ExtEmail
    Backend -- "OTEL traces" --> ExtOTEL

    Backend -- "HTTP REST" --> ExtMoMo
    Backend -- "HTTP REST" --> ExtVNPAY
    Backend -- "HTTP REST (OAuth2)" --> ExtPayPal
    Backend -- "HTTP REST" --> ExtAI

    ExtMoMo -- "IPN webhook POST" --> Backend
    ExtVNPAY -- "IPN webhook POST" --> Backend
```

## Key Interactions

| Interaction | Protocol | Notes |
|---|---|---|
| Browser ↔ Next.js BFF | HTTP, WebSocket | BFF acts as secure reverse proxy |
| BFF → Spring Boot Backend | HTTP (server-side) | API routes in `frontend/app/api/` |
| Backend → PostgreSQL | JDBC (PostgreSQL 16) | JPA + raw JdbcTemplate for performance |
| Backend → Redis | Lettuce (reactive) | JTI store, cache, Pub/Sub, locks |
| Backend → RabbitMQ | AMQP (Spring AMQP) | Topic exchange `shop.events` |
| Backend → MCP Node server | HTTP | `/api/mcp/tools`, `/api/mcp/resources` |
| MCP → Backend | HTTP | Tool calls proxy to backend REST endpoints |
| Payment gateways → Backend | HTTP POST (IPN) | MoMo and VNPAY send IPN directly to backend |
| BFF → Backend (IPN forward) | HTTP POST | BFF validates return URL signature, then calls backend IPN |

## RabbitMQ Exchange/Queue Architecture

```mermaid
graph LR
    P1["OrderService\npublisher"] -- "order.created" --> EX["shop.events\n(topic exchange)"]
    P2["PaymentService\npublisher"] -- "notification.order.paid.email" --> EX
    P3["PaymentService\npublisher"] -- "order.status.changed" --> EX
    P4["AuthService\npublisher"] -- "email.general.send" --> EX
    P5["InventoryService\npublisher"] -- "inventory.low-stock.alert" --> EX

    EX -- "order.created" --> Q1["order.created\nqueue"]
    EX -- "order.created" --> Q2["order.created.analytics\nqueue"]
    EX -- "order.created" --> Q3["order.created.fraud.check\nqueue"]
    EX -- "notification.order.paid.email" --> Q4["order.paid.email\nqueue"]
    EX -- "order.status.changed" --> Q5["order.status.changed\nqueue"]
    EX -- "email.general.send" --> Q6["email.general\nqueue"]
    EX -- "inventory.low-stock.alert" --> Q7["inventory.low-stock.alert\nqueue"]

    Q1 -- "on failure" --> DQ1["order.created.dlq"]
    Q4 -- "on failure" --> DQ4["order.paid.email.dlq"]
    Q6 -- "on failure" --> DQ6["email.general.dlq"]

    Q1 --> C1["OrderCreatedNotificationConsumer\n→ sendOrderReceivedEmail"]
    Q4 --> C4["OrderNotificationConsumer\n→ sendOrderPaidEmail"]
    Q5 --> C5["NotificationConsumer\n→ WebSocket push + app_notifications"]
    Q6 --> C6["EmailConsumer\n→ OTP / Verification / Password Reset"]
```

## Redis Key Namespaces

| Key Pattern | Purpose |
|---|---|
| `jti:<jti-value>` | Access token JTI for revocation tracking |
| `inv:lock:reserve:<orderNumber>` | Distributed lock for inventory reservation |
| `cache:products:*` | Cached product list/search responses |
| `cache:dashboard:*` | Cached admin/seller/supplier dashboards |
| `cache:invalidate:all` | Pub/Sub channel for cache invalidation |
| `rate:login:<email>:<ip>` | Login failure rate limiting |
