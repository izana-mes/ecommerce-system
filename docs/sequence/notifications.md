# Notifications Sequence Diagram

Traced from [`OrderCreatedNotificationService.java`](../../backend/src/main/java/com/example/shop/modules/notification/service/OrderCreatedNotificationService.java), [`OrderNotificationService.java`](../../backend/src/main/java/com/example/shop/modules/notification/service/OrderNotificationService.java), [`FulfillmentNotificationService.java`](../../backend/src/main/java/com/example/shop/modules/order/service/FulfillmentNotificationService.java), and [`application.yml`](../../backend/src/main/resources/application.yml).

## RabbitMQ Exchange and Queue Map

| Queue | Routing Key | Consumer |
|---|---|---|
| `order.created` | `order.created` | OrderCreatedNotificationConsumer → email to customer |
| `order.created.analytics` | `order.created` | Analytics consumer |
| `order.created.fraud.check` | `order.created` | Fraud assessment consumer |
| `order.paid.email` | `notification.order.paid.email` | OrderNotificationConsumer → payment confirmed email |
| `order.status.changed` | `order.status.changed` | WebSocket push + app_notifications |
| `email.general` | `email.general.send` | General email consumer (OTP, password reset, verification) |
| `inventory.low-stock.alert` | `inventory.low-stock.alert` | Low stock email to admin |
| `cart.abandoned` | `cart.abandoned` | Cart abandonment reminder email |
| `payment.ipn.process` | `payment.vnpay.ipn` | IPN processing consumer |
| `audit.event` | `audit.event` | Audit log consumer |

All queues have corresponding Dead Letter Queues (DLQ) suffixed with `.dlq`.

Exchange: `shop.events` (topic exchange).

---

## Order Created Notification (Email to Customer)

```mermaid
sequenceDiagram
    participant OS as OrderService
    participant MQ as RabbitMQ
    participant OCNS as OrderCreatedNotificationConsumer
    participant OCNSS as OrderCreatedNotificationService
    participant EmailSvc as EmailService
    participant Customer as Customer (email)

    OS->>MQ: publish OrderCreatedEvent\nexchange: shop.events\nrouting-key: order.created
    MQ->>OCNS: deliver to order.created queue

    OCNS->>OCNSS: sendOrderReceivedEmail(event)
    OCNSS->>OCNSS: build HTML email:\n"Order Received - #orderNumber"\nwith items, totals, tracking link
    OCNSS->>EmailSvc: sendEmail(customerEmail, subject, content)
    EmailSvc-->>Customer: "Order Received" email with tracking link

    Note over MQ,OCNS: On failure, message routes to order.created.dlq
```

## Payment Confirmed Notification (Email + Shipper Alert)

```mermaid
sequenceDiagram
    participant PaySvc as PaymentService (IPN handler)
    participant MQ as RabbitMQ
    participant ONC as OrderNotificationConsumer
    participant ONS as OrderNotificationService
    participant EmailSvc as EmailService
    participant FNS as FulfillmentNotificationService
    participant Customer as Customer (email)
    participant Shippers as Shippers (email)

    PaySvc->>MQ: publish order.paid.email event\nrouting-key: notification.order.paid.email
    MQ->>ONC: deliver to order.paid.email queue
    ONC->>ONS: sendOrderPaidEmail(request)
    ONS->>ONS: build "Payment Successful" HTML email
    ONS->>EmailSvc: sendEmail(customerEmail, subject, content)
    EmailSvc-->>Customer: "Payment Successful - Order #X" email

    PaySvc->>FNS: notifyShippersOrderPaid(orderId, orderNumber, customerEmail)
    FNS->>FNS: resolveShipperRecipients\n(query users with ROLE_SHIPPER from DB)
    FNS->>EmailSvc: sendEmail to each shipper
    EmailSvc-->>Shippers: "New paid order ready to ship" email
```

## Order Status Changed Notification (WebSocket Push)

```mermaid
sequenceDiagram
    participant PaySvc as PaymentService / OrderService
    participant MQ as RabbitMQ
    participant NSC as NotificationConsumer
    participant JT as JdbcTemplate
    participant SIMP as SimpMessagingTemplate
    participant Client as Client (browser WebSocket)

    PaySvc->>MQ: publish order.status.changed event\nrouting-key: order.status.changed
    MQ->>NSC: deliver to order.status.changed queue
    NSC->>JT: INSERT app_notifications\n(recipient=customerEmail, channel=WS, is_read=false)
    NSC->>SIMP: convertAndSendToUser(\n  customerEmail,\n  "/queue/notifications",\n  notificationPayload\n)
    SIMP-->>Client: STOMP MESSAGE frame\n/user/queue/notifications
```

## General Email Notifications (OTP, Verification, Password Reset)

```mermaid
sequenceDiagram
    participant AuthSvc as AuthService
    participant EMP as EmailMessagePublisher
    participant MQ as RabbitMQ
    participant EC as EmailConsumer
    participant EmailSvc as EmailService
    participant User as User (email)

    AuthSvc->>EMP: publish(EmailMessage{type: OTP/VERIFICATION/PASSWORD_RESET})
    EMP->>MQ: publish to email.general queue\nrouting-key: email.general.send
    MQ->>EC: deliver from email.general queue
    EC->>EmailSvc: sendEmail(to, subject, content)
    EmailSvc-->>User: email delivered

    Note over EmailSvc: EmailService routes based on MAIL_PROVIDER config:\n- SMTP (Gmail via JavaMailSender)\n- Resend (HTTP API)
```

## Low-Stock Alert Notification

```mermaid
sequenceDiagram
    participant IRS as InventoryReservationService
    participant MQ as RabbitMQ
    participant LSC as LowStockAlertConsumer
    participant EmailSvc as EmailService
    participant Admin as Admin (email)

    IRS->>MQ: publish inventory.low-stock.alert\nwhen available_stock <= low_stock_threshold (default: 5)
    MQ->>LSC: deliver to inventory.low-stock.alert queue
    LSC->>EmailSvc: sendEmail to admin
    EmailSvc-->>Admin: low stock alert email
```

## Coupon Assignment Notification

```mermaid
sequenceDiagram
    participant Admin as Admin
    participant CC as CouponController
    participant CS as CouponService
    participant JT as JdbcTemplate
    participant SIMP as SimpMessagingTemplate
    participant Customer as Customer (WebSocket)

    Admin->>CC: POST /api/v1/coupons/assign {userId, couponId}
    CC->>CS: assignCoupon(userId, couponId)
    CS->>JT: INSERT coupon_assignments
    CS->>SIMP: push WebSocket notification to user
    SIMP-->>Customer: coupon assignment push notification
```

## WebSocket Session Lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant WSE as WebSocket Endpoint (/ws)
    participant INT as WebSocketJwtAuthChannelInterceptor
    participant Redis as Redis
    participant WSR as WebSocketSessionRegistry
    participant SIMP as SimpMessagingTemplate

    C->>WSE: HTTP Upgrade → WebSocket
    WSE-->>C: 101 Switching Protocols

    C->>WSE: STOMP CONNECT (Authorization: Bearer jwt)
    WSE->>INT: preSend(CONNECT)
    INT->>INT: parse and validate JWT signature
    INT->>Redis: check JTI not revoked
    Redis-->>INT: OK
    INT->>WSR: registerSession(sessionId, userEmail)
    WSE-->>C: STOMP CONNECTED

    C->>WSE: STOMP SUBSCRIBE /user/queue/notifications
    WSE-->>C: subscription acknowledged

    Note over SIMP,C: Server pushes messages when events occur

    SIMP->>WSE: convertAndSendToUser(email, /queue/notifications, payload)
    WSE-->>C: STOMP MESSAGE

    C->>WSE: STOMP DISCONNECT
    WSE->>WSR: deregisterSession(sessionId)
```
