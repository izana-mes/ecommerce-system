# Order Processing Sequence Diagram

Traced from [`OrderServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/order/service/OrderServiceImpl.java), [`FulfillmentNotificationService.java`](../../backend/src/main/java/com/example/shop/modules/order/service/FulfillmentNotificationService.java), and RabbitMQ config in [`application.yml`](../../backend/src/main/resources/application.yml).

## Payment Confirmed → Fulfillment Notification

```mermaid
sequenceDiagram
    participant PS as PaymentService (MoMo/VNPAY)
    participant JT as JdbcTemplate
    participant IRS as InventoryReservationService
    participant InvR as InventoryRepository
    participant MQ as RabbitMQ
    participant FNS as FulfillmentNotificationService
    participant EmailSvc as EmailService
    participant DB as PostgreSQL

    PS->>JT: UPDATE payments SET status=paid
    PS->>JT: UPDATE orders SET payment_status=paid
    PS->>IRS: confirmByOrderNumber(orderNumber)
    IRS->>InvR: find by productId FOR UPDATE
    InvR-->>IRS: Inventory entity
    IRS->>InvR: save (reserved_stock - qty, packed_stock + qty)
    IRS-->>PS: confirmed

    PS->>MQ: publish order.paid.email event\n(routing key: notification.order.paid.email)
    MQ->>FNS: consume order.paid.email queue
    FNS->>DB: SELECT users with ROLE_SHIPPER
    DB-->>FNS: shipper emails
    FNS->>EmailSvc: sendEmail to each shipper\n"New paid order ready to ship"

    PS->>MQ: publish order.status.changed event\n(routing key: order.status.changed)
```

## Order Status Transitions (Admin/Staff Actions)

```mermaid
sequenceDiagram
    participant Admin as Admin/Staff
    participant OC as OrderController
    participant OS as OrderService
    participant JT as JdbcTemplate
    participant MQ as RabbitMQ
    participant NS as NotificationService
    participant C as Customer (WebSocket)

    Note over Admin,C: Status: pending → paid (via payment IPN, not admin action)

    Admin->>OC: PATCH /api/v1/orders/{id}/status {newStatus}
    OC->>OS: updateOrderStatus(orderNumber, newStatus, user)
    OS->>JT: SELECT current order status
    OS->>OS: validate allowed transition
    OS->>JT: UPDATE orders SET order_status = newStatus
    OS->>JT: INSERT order_status_logs (previous, new, changed_by)
    OS->>MQ: publish order.status.changed event
    MQ->>NS: consume order.status.changed queue
    NS->>JT: INSERT app_notifications (recipient = customer email)
    NS->>C: STOMP push via /user/queue/notifications
```

## Shipper Delivery Flow

```mermaid
sequenceDiagram
    participant Shipper as Shipper (mobile)
    participant OC as OrderController
    participant OS as OrderService
    participant JT as JdbcTemplate
    participant MQ as RabbitMQ

    Note over Shipper,MQ: Order is in "packed" or "shipped" state

    Shipper->>OC: POST /api/v1/shipper/orders/{orderNumber}/pickup
    OC->>OS: markPickedUp(orderNumber, shipperUser)
    OS->>JT: UPDATE orders SET order_status=shipped, shipper_user_id=shipperUserId, picked_up_at=now
    OS->>MQ: publish order.status.changed {status: shipped}

    Shipper->>OC: POST /api/v1/shipper/orders/{orderNumber}/deliver
    OC->>OS: markDelivered(orderNumber, shipperUser, locationData)
    OS->>JT: UPDATE orders SET order_status=completed\ndelivered_at=now, delivery_success=true\ndelivery_latitude, delivery_longitude
    OS->>MQ: publish order.status.changed {status: completed}

    Shipper->>OC: POST /api/v1/shipper/orders/{orderNumber}/fail
    OC->>OS: markDeliveryFailed(orderNumber, shipperUser, reason)
    OS->>JT: UPDATE orders SET order_status=failed\nfailed_at=now, failure_reason=reason
    OS->>MQ: publish order.status.changed {status: failed}
```

## Undelivered Order Reminders (Scheduled)

```mermaid
sequenceDiagram
    participant SCH as Scheduler (every 30min)
    participant FNS as FulfillmentNotificationService
    participant JT as JdbcTemplate
    participant EmailSvc as EmailService

    SCH->>FNS: sendUndeliveredPaidOrderReminders()
    FNS->>FNS: processReminderForDay(2)
    FNS->>JT: SELECT paid orders older than 2 days\nnot completed/cancelled\nno reminder_day=2 record
    JT-->>FNS: List of orders
    FNS->>JT: SELECT users with ROLE_SHIPPER
    loop for each overdue order
        FNS->>EmailSvc: send "Day-2 reminder" to shippers
        FNS->>JT: INSERT order_delivery_reminders (order_id, reminder_day=2)
    end

    FNS->>FNS: processReminderForDay(3)
    FNS->>JT: SELECT paid orders older than 3 days (no day-3 reminder)
    loop for each order
        FNS->>EmailSvc: send "Day-3 reminder" to shippers
        FNS->>JT: INSERT order_delivery_reminders (order_id, reminder_day=3)
    end
```

## Inventory Reservation Expiry (Background)

```mermaid
sequenceDiagram
    participant SCH as Scheduler (every 5s)
    participant IRS as InventoryReservationServiceImpl
    participant InvResR as InventoryReservationRepository
    participant InvR as InventoryRepository
    participant PR as ProductRepository
    participant MQ as RabbitMQ

    SCH->>IRS: runExpiry()
    IRS->>InvResR: findTop200 where status=ACTIVE and expires_at < now
    InvResR-->>IRS: expired reservations
    loop for each reservation
        IRS->>InvR: load Inventory for each item
        IRS->>InvR: reserved_stock - qty, available_stock + qty
        IRS->>PR: restore product.stockQuantity
        IRS->>InvResR: save (status=EXPIRED, released_at=now)
    end
    IRS->>MQ: publish inventory.released event
```
