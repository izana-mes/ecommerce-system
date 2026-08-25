# Checkout Activity Diagram

Activity flows traced from [`OrderServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/order/service/OrderServiceImpl.java) and [`InventoryReservationServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/inventory/service/InventoryReservationServiceImpl.java).

## Order Creation (Checkout) Flow

```mermaid
flowchart TD
    A([Client: POST /api/v1/orders]) --> B[Extract authenticated User\nor guest email from request]
    B --> C[Validate required fields\nif orderSource = checkout-ui]
    C --> D{Fields valid?}
    D -- No --> E([Throw 400 BAD REQUEST])
    D -- Yes --> F[Load products from DB by productId list\nProductRepository.findByProductIDIn]
    F --> G{All products found?}
    G -- No --> H([Throw 404 NOT FOUND])
    G -- Yes --> I[Check each product is active\nand stock >= requested quantity]
    I --> J{Stock sufficient?}
    J -- No --> K([Throw 409 CONFLICT: insufficient stock])
    J -- Yes --> L[Compute line totals and subtotal\nunitPrice × quantity]
    L --> M[Apply shipping fee and VAT\ndefault: $5 shipping, $11 VAT if subtotal > 0]
    M --> N[Apply coupon discount\ncapped to total amount]
    N --> O[Compute loyalty points redemption\n100 points = $1 discount\nmax 25% of pre-points total]
    O --> P[Compute final total\nsubtotal + shipping + vat - discount - points discount]
    P --> Q[Compute points earned = total × 5%]
    Q --> R[Generate orderNumber UUID prefix\ngenerate tracking secret UUID]
    R --> S[INSERT into orders table\nstatus: pending, payment_status: pending]
    S --> T[INSERT order_items rows\none per product line]
    T --> U[INSERT into payments table\nstatus: pending, amount: total]
    U --> V[InventoryReservationService.reserve\nttl = 300 minutes]

    V --> W{Payment method = COD?}
    W -- Yes --> X[InventoryReservationService.confirmByOrderNumber\nimmediately confirm reservation]
    W -- No --> Y[Reservation remains PENDING\nexpires in 5 hours if unpaid]

    X --> Z[Clear purchased cart items for user]
    Y --> Z
    Z --> AA[Apply loyalty changes to user\nsubtract redeemed, add earned]
    AA --> AB[OrderCheckoutHistoryService.saveCheckoutInfo]
    AB --> AC[Publish OrderCreatedEvent to RabbitMQ\nrouting key: order.created]
    AC --> AD([Return OrderCreateResponse\norderId, orderNumber, trackingSecret, totals])
```

## Inventory Reservation Flow (Detail)

```mermaid
flowchart TD
    A[InventoryReservationService.reserve] --> B[For each product in order:\nAcquire Redis distributed lock\nlock key: inventory:lock:productId]
    B --> C{Lock acquired?}
    C -- No --> D([Throw 409: unable to lock inventory])
    C -- Yes --> E[SELECT inventories WHERE product_id = ?\nFOR UPDATE SKIP LOCKED]
    E --> F{available_stock >= quantity?}
    F -- No --> G[Release Redis lock]
    G --> H([Throw 409: insufficient stock])
    F -- Yes --> I[Decrement available_stock\nIncrement reserved_stock\nVersion bump optimistic lock]
    I --> J[Insert inventory_transaction record\ntype: RESERVED]
    J --> K[Release Redis lock]
    K --> L[Insert inventory_reservation record\nstatus: PENDING, expires_at = now + ttl]
    L --> M[Insert inventory_reservation_items]
    M --> N[Publish inventory.reserved event to RabbitMQ]
    N --> O([Reservation complete])

    P([5-second scheduler job]) --> Q[SELECT active reservations\nWHERE expires_at < NOW]
    Q --> R{Any expired?}
    R -- No --> S([Done])
    R -- Yes --> T[For each expired reservation:\nincrement available_stock back\ndecrement reserved_stock\nmark reservation EXPIRED]
    T --> U[Insert inventory_transaction\ntype: RESERVATION_EXPIRED]
    U --> V[Publish inventory.released event to RabbitMQ]
    V --> S
```

## Order Cancellation Flow (Customer)

```mermaid
flowchart TD
    A([Client: POST /api/v1/orders/cancel]) --> B[Load order by orderNumber + customerEmail]
    B --> C{Order found?}
    C -- No --> D([Throw 404])
    C -- Yes --> E{order_status = pending\nAND payment_status = pending?}
    E -- No --> F([Throw 409: only pending orders can be cancelled])
    E -- Yes --> G[UPDATE orders SET order_status=cancelled\npayment_status=cancelled]
    G --> H[UPDATE payments SET status=cancelled]
    H --> I[InventoryReservationService.releaseByOrderNumber\ncause: customer_cancelled]
    I --> J[Publish order status changed event\nrouting key: order.status.changed]
    J --> K([Return 200 OK])
```
