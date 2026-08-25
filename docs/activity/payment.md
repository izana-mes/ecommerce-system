# Payment Activity Diagrams

Flows traced from [`MomoPaymentServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/payment/service/MomoPaymentServiceImpl.java), [`VnpayPaymentServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/payment/service/VnpayPaymentServiceImpl.java), and [`PayPalPaymentServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/payment/paypal/service/PayPalPaymentServiceImpl.java).

> [!CAUTION]
> **Known Bug — PayPal Inventory Leak**: `PayPalPaymentServiceImpl.triggerPostPaymentActions()` does **not** call `inventoryReservationService.confirmByOrderNumber()`. The inventory reservation remains in `PENDING` state and will be released by the 5-second scheduler when it expires, adding stock back. This causes incorrect inventory counts for paid PayPal orders.

---

## MoMo Payment Flow

```mermaid
flowchart TD
    A([Client: POST /api/v1/payment/momo/initiate]) --> B[Load order from DB\nverify order belongs to customer]
    B --> C[Convert USD amount to VND\nusdToVndRate from config]
    C --> D[Build MoMo request payload\norderInfo, requestId, amount, returnUrl, ipnUrl]
    D --> E[Generate HMAC-SHA256 signature\nusing MOMO_SECRET_KEY]
    E --> F[POST to MoMo API endpoint\nhttps://test-payment.momo.vn/v2/gateway/api/create]
    F --> G{MoMo returns payUrl?}
    G -- No --> H([Throw: payment initiation failed])
    G -- Yes --> I([Return payUrl to client])
    I --> J([Client redirects to MoMo payment page])

    J --> K([User completes payment on MoMo])
    K --> L([MoMo redirects browser to\nfrontend returnUrl with query params])

    L --> M([BFF: Next.js verifies returnUrl signature\nusing MOMO_SECRET_KEY on BFF side])
    M --> N{Signature valid?}
    N -- No --> O([Show error page])
    N -- Yes --> P([BFF: POST to backend /api/v1/payment/momo/ipn\nforwarding MoMo params])

    K --> Q([MoMo sends IPN webhook to\nbackend ipnUrl directly])

    subgraph Backend IPN Processing
        R([POST /api/v1/payment/momo/ipn]) --> S[Validate HMAC-SHA256 signature\nusing MOMO_SECRET_KEY]
        S --> T{Signature valid?}
        T -- No --> U([Return 400])
        T -- Yes --> V{resultCode = 0?}
        V -- No --> W[Update order/payment status\nto failed or pending]
        W --> X([Return 200])
        V -- Yes --> Y[Load order from DB by orderId]
        Y --> Z[Check amount matches\norder.total_amount × usdToVndRate]
        Z --> AA{Amount matches?}
        AA -- No --> AB([Return 400: amount mismatch])
        AA -- Yes --> AC[Idempotency check:\nINSERT INTO payment_webhook_events\nevent_key = requestId]
        AC --> AD{Already processed?}
        AD -- Yes --> AE([Return 200: duplicate ignored])
        AD -- No --> AF[UPDATE payments SET status=paid, paid_at=now]
        AF --> AG[UPDATE orders SET payment_status=paid]
        AG --> AH[InventoryReservationService.confirmByOrderNumber\nPENDING → CONFIRMED, stock moves reserved→packed]
        AH --> AI[CouponService.redeemCouponForPaidOrder]
        AI --> AJ[Publish order paid email event to RabbitMQ\nrouting key: notification.order.paid.email]
        AJ --> AK[Publish order status changed event]
        AK --> AL([Return 200 OK])
    end
```

---

## VNPAY Payment Flow

```mermaid
flowchart TD
    A([Client: POST /api/v1/payment/vnpay/initiate]) --> B[Load order from DB]
    B --> C[Convert USD amount to VND\nmultiply by 100 for VNPAY format]
    C --> D[Build query params:\nvnp_Amount, vnp_OrderInfo, vnp_TxnRef, etc.]
    D --> E[Sort params alphabetically\nbuild hashData string]
    E --> F[Generate HMAC-SHA512 signature\nusing VNPAY_HASH_SECRET]
    F --> G([Return VNPAY payment URL to client])
    G --> H([Client redirects to VNPAY gateway])

    H --> I([User pays on VNPAY])
    I --> J([VNPAY redirects to frontend returnUrl])

    J --> K([BFF: validate vnp_SecureHash signature\nusing VNPAY_HASH_SECRET on BFF side])
    K --> L{Signature valid?}
    L -- No --> M([Show error page])
    L -- Yes --> N([BFF: POST to backend /api/v1/payment/vnpay/ipn])

    I --> O([VNPAY sends IPN POST to backend ipnUrl])

    subgraph Backend IPN Processing
        P([POST /api/v1/payment/vnpay/ipn]) --> Q[Validate vnp_SecureHash signature]
        Q --> R{Signature valid?}
        R -- No --> S([Return RspCode: 97 invalid signature])
        R -- Yes --> T[Load order by vnp_TxnRef = orderNumber]
        T --> U{Order found?}
        U -- No --> V([Return RspCode: 01 order not found])
        U -- Yes --> W[Check vnp_Amount = order.total_amount × 100 × usdToVndRate]
        W --> X{Amount correct?}
        X -- No --> Y([Return RspCode: 04 invalid amount])
        X -- Yes --> Z[Idempotency check:\nINSERT payment_webhook_events event_key = vnp_TransactionNo]
        Z --> AA{Duplicate?}
        AA -- Yes --> AB([Return RspCode: 02 duplicate])
        AA -- No --> AC{vnp_ResponseCode = 00?}
        AC -- No --> AD[Mark payment/order as failed]
        AD --> AE([Return RspCode: 00 received])
        AC -- Yes --> AF[UPDATE payments status=paid]
        AF --> AG[UPDATE orders payment_status=paid]
        AG --> AH[InventoryReservationService.confirmByOrderNumber]
        AH --> AI[CouponService.redeemCouponForPaidOrder]
        AI --> AJ[Publish order paid email event to RabbitMQ]
        AJ --> AK[Publish order status changed event]
        AK --> AL([Return RspCode: 00])
    end
```

---

## PayPal Payment Flow

> [!WARNING]
> PayPal does **not** confirm inventory reservation on capture. See caution note at the top of this document.

```mermaid
flowchart TD
    A([Client: POST /api/v1/payment/paypal/create-order]) --> B[Load order from DB]
    B --> C[Build PayPal OrderRequest:\namount, currency_code, reference_id = orderNumber]
    C --> D[POST to PayPal API /v2/checkout/orders\nusing OAuth2 Bearer token]
    D --> E{PayPal returns orderId?}
    E -- No --> F([Throw: PayPal order creation failed])
    E -- Yes --> G([Return paypalOrderId to client])
    G --> H([Client renders PayPal JS SDK button])

    H --> I([User approves payment in PayPal UI])
    I --> J([Client: POST /api/v1/payment/paypal/capture-order\nwith paypalOrderId])

    J --> K[POST to PayPal API /v2/checkout/orders/id/capture]
    K --> L{Capture status = COMPLETED?}
    L -- No --> M([Throw: capture failed or declined])
    L -- Yes --> N[Idempotency check:\nINSERT payment_webhook_events event_key = captureId]
    N --> O{Duplicate?}
    O -- Yes --> P([Return 200 already processed])
    O -- No --> Q[UPDATE payments\nset status=paid, paypal_order_id, paypal_capture_id, payer_email]
    Q --> R[UPDATE orders SET payment_status=paid]
    R --> S[CouponService.redeemCouponForPaidOrder]
    S --> T[Publish order paid email event to RabbitMQ]
    T --> U[Publish order status changed event]
    U --> V([Return 200 - payment captured])

    W[/BUG: inventoryReservationService.confirmByOrderNumber\nNOT called here/]
    V -. missing call .-> W
    W --> X[Reservation expires after TTL\nScheduler restores stock\nInventory data is incorrect]
```
