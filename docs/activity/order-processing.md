# Order Processing Activity Diagram

Flows traced from [`OrderServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/order/service/OrderServiceImpl.java), [`InventoryReservationServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/inventory/service/InventoryReservationServiceImpl.java), and [`FulfillmentNotificationService.java`](../../backend/src/main/java/com/example/shop/modules/order/service/FulfillmentNotificationService.java).

## Order Status State Machine

```mermaid
flowchart LR
    A([pending]) -- Payment confirmed\nMoMo/VNPAY IPN or PayPal capture --> B([paid])
    A -- Customer cancels\nOR payment timeout --> Z([cancelled])
    B -- Admin/staff marks processing --> C([processing])
    C -- Staff packs items --> D([packed])
    D -- Shipper picks up --> E([shipped])
    E -- Delivered confirmed --> F([completed])
    E -- Delivery failed --> G([failed])
    B -- Direct cancel by admin --> Z
    C -- Direct cancel by admin --> Z
```

## Payment Status State Machine

```mermaid
flowchart LR
    A([pending]) -- IPN success --> B([paid])
    A -- Order cancelled --> C([cancelled])
    A -- IPN failure --> D([failed])
    B -- Refund issued --> E([refunded])
```

## Inventory Reservation Lifecycle

```mermaid
flowchart TD
    A([Order Created]) --> B[reserve called\nstatus = ACTIVE\nexpires_at = now + 300min]
    B --> C{Payment method?}
    C -- COD --> D[confirmByOrderNumber immediately\nstatus = CONFIRMED\nreserved_stock → packed_stock]
    C -- Online payment --> E[Reservation remains ACTIVE]

    E --> F{Payment received\nwithin TTL?}
    F -- Yes\nMoMo/VNPAY IPN success --> G[confirmByOrderNumber\nstatus = CONFIRMED\nreserved_stock → packed_stock]
    F -- No / PayPal bug --> H[5-second scheduler:\nrunExpiry checks expired reservations]
    H --> I[Reservation EXPIRED\npacked_stock or reserved_stock → available_stock\nProduct stockQuantity restored]
    I --> J[Publish inventory.released event to RabbitMQ]

    G --> K([Inventory committed])
    D --> K
```

## Fulfillment Notification Flow

```mermaid
flowchart TD
    A([Payment IPN confirmed]) --> B[notifyShippersOrderPaid called]
    B --> C[Query users with ROLE_SHIPPER\nfrom DB]
    C --> D{Shipper users found?}
    D -- No --> E[Fallback: use admin email\nfrom config]
    D -- Yes --> F[Send HTML email:\nNew paid order ready to ship]
    E --> F

    G([Every 30 minutes: scheduler]) --> H{reminderEnabled = true?}
    H -- No --> I([Skip])
    H -- Yes --> J[Query paid orders > 2 days old\nnot completed/cancelled\nno reminder_day=2 record]
    J --> K[Send Day-2 reminder email to shippers\nInsert order_delivery_reminders record]
    K --> L[Query paid orders > 3 days old\nnot completed/cancelled\nno reminder_day=3 record]
    L --> M[Send Day-3 reminder email to shippers\nInsert order_delivery_reminders record]
    M --> N([Done])
```

## Customer Order Cancellation

```mermaid
flowchart TD
    A([Customer: cancel order]) --> B{order_status = pending\nAND payment_status = pending?}
    B -- No --> C([Throw 409: cannot cancel])
    B -- Yes --> D[UPDATE orders: status=cancelled, payment_status=cancelled]
    D --> E[UPDATE payments: status=cancelled]
    E --> F[InventoryReservationService.releaseByOrderNumber\ncause: customer_cancelled]
    F --> G[reserved_stock → available_stock\nProduct stockQuantity restored]
    G --> H[Publish order.status.changed event to RabbitMQ]
    H --> I([Return 200])
```
