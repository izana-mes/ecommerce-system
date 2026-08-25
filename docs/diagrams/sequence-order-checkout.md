# Order / Checkout Sequence Diagram

This sequence diagram details the runtime interactions for Order Creation and Order Cancellation across `OrderController`, `OrderServiceImpl`, `ProductRepository`, `InventoryReservationService`, `CartItemRepository`, `OrderCheckoutHistoryServiceImpl`, and RabbitMQ / WebSocket event publishers.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer / User
    participant OC as OrderController
    participant OS as OrderServiceImpl
    participant PR as ProductRepository
    participant DB as Orders / Items / Payments DB Tables
    participant IRS as InventoryReservationService
    participant CR as CartItemRepository
    participant UR as UserRepository
    participant CH as OrderCheckoutHistoryService / Redis
    participant MQ as OrderCreatedEventPublisher / RabbitMQ
    participant WS as SimpMessagingTemplate / WebSocket

    %% CREATE ORDER FLOW
    rect rgb(240, 248, 255)
        note over Customer, MQ: Order Creation Flow
        Customer->>OC: POST /api/orders (OrderCreateRequest)
        OC->>OS: createOrder(request, authenticatedUser)

        %% EMAIL & SOURCE VALIDATION
        OS->>OS: Resolve customerEmail (authenticated User email or request.customerEmail)
        alt Missing Customer Email
            OS-->>OC: throw BusinessException(400 Bad Request: Customer email required)
            OC-->>Customer: 400 Bad Request
        end
        opt orderSource == "checkout-ui"
            OS->>OS: Validate required checkout fields (firstName, lastName, phone, address, city, country)
            alt Missing Required Fields
                OS-->>OC: throw BusinessException(400 Bad Request: Missing fields)
                OC-->>Customer: 400 Bad Request
            end
        end

        %% PRODUCT RESOLUTION & STOCK CHECK
        OS->>PR: findByProductIDIn(deduplicatedProductIDs)
        PR-->>OS: List<Product>
        alt Any Product Missing
            OS-->>OC: throw BusinessException(404 Not Found: Product not found)
            OC-->>Customer: 404 Not Found
        else Product Inactive or Stock Insufficient
            OS-->>OC: throw BusinessException(409 Conflict: Inactive or out of stock)
            OC-->>Customer: 409 Conflict
        end

        %% FINANCIAL & LOYALTY CALCULATIONS
        OS->>OS: Calculate subtotal, shippingFee, vat, couponDiscount
        opt Points Redemption Requested
            OS->>OS: Compute loyalty redemption (100 pts = $1, max 25% of prePointsTotal)
        end
        OS->>OS: Compute totalAmount & pointsEarned (5% of totalAmount)

        %% DB PERSISTENCE
        OS->>DB: INSERT INTO orders (order_number, total_amount, payment_status='pending', order_status='pending')
        DB-->>OS: generated order_id
        OS->>DB: INSERT INTO order_items (order_id, product_id, unit_price, quantity, line_total)
        OS->>DB: INSERT INTO payments (order_id, provider='manual', status='pending', method=paymentMethod)

        %% INVENTORY RESERVATION
        OS->>IRS: reserve(orderId, items, TTL=300m)
        opt paymentMethod is COD ("cod" or "cash on delivery")
            OS->>IRS: confirmReservation(orderId)
        end

        %% POST-CREATION SIDE EFFECTS
        OS->>CR: clearPurchasedCartItems(user, productIDs)
        opt Authenticated User
            OS->>UR: applyLoyaltyChanges(user, pointsRedeemed, pointsEarned)
        end
        OS->>CH: saveCheckoutInfo(userId, checkoutFormJson)
        CH->>CH: Persist into Redis ZSet/List
        OS->>MQ: publish(OrderCreatedEvent)

        OS-->>OC: OrderCreateResponse (orderId, orderNumber, trackingSecret, totalAmount, points)
        OC-->>Customer: 200 OK (OrderCreateResponse)
    end

    %% CANCEL ORDER FLOW
    rect rgb(255, 240, 245)
        note over Customer, WS: Order Cancellation Flow
        Customer->>OC: POST /api/orders/cancel (trackingSecret or orderId)
        OC->>OS: cancelOrder(trackingSecret / orderId, user)
        OS->>DB: findByTrackingSecret / findById
        alt Order Not Found
            DB-->>OS: Optional.empty()
            OS-->>OC: throw BusinessException(404 Not Found)
            OC-->>Customer: 404 Not Found
        else Order Not Pending
            DB-->>OS: Optional.of(order with status != 'pending')
            OS-->>OC: throw BusinessException(400 Bad Request: Only pending orders can be cancelled)
            OC-->>Customer: 400 Bad Request
        else Pending Order Found
            DB-->>OS: Optional.of(order)
            OS->>DB: UPDATE orders SET order_status='cancelled', payment_status='cancelled'
            OS->>DB: UPDATE payments SET status='cancelled' WHERE status='pending'
            OS->>IRS: releaseReservation(orderId, reason="customer_cancelled")
            OS->>WS: convertAndSend("/topic/orders/customer/" + email, "CUSTOMER_CANCELLED")
            OS-->>OC: SimpleMessageResponse("Order cancelled successfully")
            OC-->>Customer: 200 OK
        end
    end
```
