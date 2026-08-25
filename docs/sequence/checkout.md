# Checkout Sequence Diagram

Traced from [`OrderServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/order/service/OrderServiceImpl.java) and [`InventoryReservationServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/inventory/service/InventoryReservationServiceImpl.java).

## Checkout — Order Creation

```mermaid
sequenceDiagram
    participant C as Client
    participant BFF as BFF (Next.js)
    participant OC as OrderController
    participant OS as OrderService
    participant PR as ProductRepository
    participant JT as JdbcTemplate (orders/payments)
    participant IRS as InventoryReservationService
    participant Redis as Redis
    participant InvR as InventoryRepository
    participant InvTR as InventoryTransactionRepository
    participant MQ as RabbitMQ
    participant CHS as OrderCheckoutHistoryService

    C->>BFF: POST /checkout (with cart items)
    BFF->>OC: POST /api/v1/orders {items, shipping, paymentMethod, coupon, points}
    OC->>OS: createOrder(request, user)
    OS->>OS: validateRequest (required fields for checkout-ui source)
    OS->>PR: findByProductIDIn(productIds)
    PR-->>OS: List of Product entities
    OS->>OS: Check each product is active and stock >= qty
    OS->>OS: Compute subtotal, shipping, VAT, coupon discount, loyalty points discount, total

    OS->>JT: INSERT INTO orders (status=pending, payment_status=pending)
    JT-->>OS: orderId, orderNumber, trackingSecret

    OS->>JT: INSERT INTO order_items (one row per product line)

    OS->>JT: INSERT INTO payments (status=pending, amount=total)

    OS->>IRS: reserve(reserveRequest, user)
    IRS->>Redis: SET inv:lock:reserve:orderNumber EX 15s
    loop for each product
        IRS->>InvR: findByProductId FOR UPDATE SKIP LOCKED
        InvR-->>IRS: Inventory entity
        IRS->>IRS: Check available_stock >= qty
        IRS->>InvR: save (available_stock - qty, reserved_stock + qty)
        IRS->>InvTR: save InventoryTransaction (type=RESERVE)
    end
    IRS->>JT: INSERT inventory_reservations (status=ACTIVE, expires_at=now+300min)
    IRS->>JT: INSERT inventory_reservation_items
    IRS->>MQ: publish inventory.reserved event
    IRS->>Redis: DEL lock key
    IRS-->>OS: ReservationResponse

    alt Payment method is COD
        OS->>IRS: confirmByOrderNumber(orderNumber)
        IRS-->>OS: OK (status=CONFIRMED, reserved→packed)
    end

    OS->>OS: clearPurchasedCartItems (delete cart_items for user)
    OS->>OS: applyLoyaltyChanges (subtract redeemed, add earned points)
    OS->>CHS: saveCheckoutInfo(user, request, email)

    OS->>MQ: publish OrderCreatedEvent\n(routing key: order.created)

    OS-->>OC: OrderCreateResponse {orderId, orderNumber, trackingSecret, totals, paymentStatus=pending}
    OC-->>BFF: 200 OK
    BFF-->>C: {orderNumber, trackingSecret, payUrl if applicable}
```

## Inventory Expiry (Background Scheduler)

```mermaid
sequenceDiagram
    participant SCH as Scheduler (every 5s)
    participant IRS as InventoryReservationServiceImpl
    participant InvResR as InventoryReservationRepository
    participant InvR as InventoryRepository
    participant InvTR as InventoryTransactionRepository
    participant PR as ProductRepository
    participant MQ as RabbitMQ

    SCH->>IRS: runExpiry()
    IRS->>InvResR: findTop200ByStatusAndExpiresAtBefore(ACTIVE, now)
    InvResR-->>IRS: List of expired reservations

    loop for each expired reservation
        IRS->>InvR: lockOrCreateInventory(productId)
        InvR-->>IRS: Inventory entity
        IRS->>InvR: save (reserved_stock - qty, available_stock + qty)
        IRS->>InvTR: save InventoryTransaction (type=EXPIRE_RELEASE)
        IRS->>PR: restore product.stockQuantity
        IRS->>InvResR: save reservation (status=EXPIRED, releasedAt=now)
    end
    IRS->>MQ: publish inventory.released event
```
