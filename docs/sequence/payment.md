# Payment Sequence Diagrams

Traced from [`MomoPaymentServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/payment/service/MomoPaymentServiceImpl.java), [`VnpayPaymentServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/payment/service/VnpayPaymentServiceImpl.java), and [`PayPalPaymentServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/payment/paypal/service/PayPalPaymentServiceImpl.java).

> [!CAUTION]
> **PayPal Inventory Bug**: `PayPalPaymentServiceImpl.triggerPostPaymentActions()` does **not** call `inventoryReservationService.confirmByOrderNumber()`. The reservation expires via the 5-second scheduler and stock is restored incorrectly.

---

## MoMo Payment Sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant BFF as BFF (Next.js)
    participant PC as PaymentController
    participant MS as MomoService
    participant JT as JdbcTemplate
    participant MoMoGW as MoMo Gateway (external)
    participant MQ as RabbitMQ
    participant IRS as InventoryReservationService
    participant CS as CouponService

    C->>BFF: Click "Pay with MoMo"
    BFF->>PC: POST /api/v1/payment/momo/initiate {orderNumber}
    PC->>MS: initiate(orderNumber, user)
    MS->>JT: SELECT order by orderNumber + customerEmail
    JT-->>MS: order {totalAmount, currency}
    MS->>MS: convert USD to VND (amount × usdToVndRate)
    MS->>MS: build MoMo payload (HMAC-SHA256 signature)
    MS->>MoMoGW: POST /v2/gateway/api/create
    MoMoGW-->>MS: {payUrl, resultCode}
    MS-->>PC: payUrl
    PC-->>BFF: {payUrl}
    BFF-->>C: redirect to payUrl

    Note over C,MoMoGW: User completes payment on MoMo

    MoMoGW->>BFF: GET returnUrl?orderId=...&resultCode=...&signature=...
    BFF->>BFF: verify HMAC-SHA256 signature (MOMO_SECRET_KEY)
    alt signature invalid
        BFF-->>C: show error page
    else signature valid
        BFF->>PC: POST /api/v1/payment/momo/ipn (forwarding params)
    end

    par MoMo also sends direct IPN
        MoMoGW->>PC: POST /api/v1/payment/momo/ipn
    end

    PC->>MS: processIpn(params)
    MS->>MS: verify HMAC-SHA256 signature
    alt signature invalid
        MS-->>PC: 400 Bad Request
    else valid
        MS->>JT: SELECT order by orderId
        MS->>MS: check amount = order.total × usdToVndRate
        alt amount mismatch
            MS-->>PC: 400 amount mismatch
        else amount OK
            MS->>JT: INSERT payment_webhook_events (idempotency lock)
            alt duplicate eventKey
                MS-->>PC: 200 already processed
            else first time
                alt resultCode = 0 (success)
                    MS->>JT: UPDATE payments SET status=paid
                    MS->>JT: UPDATE orders SET payment_status=paid
                    MS->>IRS: confirmByOrderNumber(orderNumber)
                    IRS-->>MS: OK (reserved→packed)
                    MS->>CS: redeemCouponForPaidOrder(orderId)
                    MS->>MQ: publish order.paid.email event
                    MS->>MQ: publish order.status.changed event
                else resultCode != 0 (failure)
                    MS->>JT: UPDATE payments SET status=failed
                    MS->>JT: UPDATE orders SET payment_status=failed
                end
                MS-->>PC: 200 OK
            end
        end
    end
```

---

## VNPAY Payment Sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant BFF as BFF (Next.js)
    participant PC as PaymentController
    participant VS as VnpayService
    participant JT as JdbcTemplate
    participant VNPGW as VNPAY Gateway (external)
    participant MQ as RabbitMQ
    participant IRS as InventoryReservationService
    participant CS as CouponService

    C->>BFF: Click "Pay with VNPAY"
    BFF->>PC: POST /api/v1/payment/vnpay/initiate {orderNumber}
    PC->>VS: initiate(orderNumber, user)
    VS->>JT: SELECT order by orderNumber
    VS->>VS: build VNPAY params, sort alphabetically
    VS->>VS: generate HMAC-SHA512 signature (VNPAY_HASH_SECRET)
    VS-->>PC: VNPAY payment URL
    PC-->>BFF: {paymentUrl}
    BFF-->>C: redirect to VNPAY URL

    Note over C,VNPGW: User pays on VNPAY

    VNPGW->>BFF: GET returnUrl?vnp_ResponseCode=...&vnp_SecureHash=...
    BFF->>BFF: verify HMAC-SHA512 (VNPAY_HASH_SECRET)
    alt invalid
        BFF-->>C: show error
    else valid
        BFF->>PC: POST /api/v1/payment/vnpay/ipn (forwarded params)
    end

    par VNPAY also sends direct IPN
        VNPGW->>PC: POST /api/v1/payment/vnpay/ipn
    end

    PC->>VS: processIpn(params)
    VS->>VS: verify vnp_SecureHash signature
    alt invalid
        VS-->>PC: RspCode 97 (invalid signature)
    else valid
        VS->>JT: SELECT order by vnp_TxnRef = orderNumber
        alt not found
            VS-->>PC: RspCode 01
        else found
            VS->>VS: check vnp_Amount == order.total × usdToVndRate × 100
            alt mismatch
                VS-->>PC: RspCode 04
            else match
                VS->>JT: INSERT payment_webhook_events (idempotency)
                alt duplicate
                    VS-->>PC: RspCode 02
                else first time
                    alt vnp_ResponseCode = 00
                        VS->>JT: UPDATE payments SET status=paid
                        VS->>JT: UPDATE orders SET payment_status=paid
                        VS->>IRS: confirmByOrderNumber(orderNumber)
                        VS->>CS: redeemCouponForPaidOrder(orderId)
                        VS->>MQ: publish order.paid.email event
                        VS->>MQ: publish order.status.changed event
                    else failure code
                        VS->>JT: UPDATE payments SET status=failed
                    end
                    VS-->>PC: RspCode 00
                end
            end
        end
    end
```

---

## PayPal Payment Sequence

> [!WARNING]
> After capture, `inventoryReservationService.confirmByOrderNumber()` is **not called**. The inventory reservation will expire and stock will be incorrectly restored.

```mermaid
sequenceDiagram
    participant C as Client
    participant BFF as BFF (Next.js)
    participant PC as PaymentController
    participant PS as PayPalService
    participant JT as JdbcTemplate
    participant PPGW as PayPal API (external)
    participant MQ as RabbitMQ
    participant CS as CouponService

    C->>BFF: Load checkout page
    BFF->>PC: POST /api/v1/payment/paypal/create-order {orderNumber}
    PC->>PS: createOrder(orderNumber, user)
    PS->>JT: SELECT order by orderNumber
    PS->>PPGW: POST /v2/checkout/orders {amount, currency, reference_id}
    PPGW-->>PS: {id: paypalOrderId, status: CREATED}
    PS->>JT: UPDATE payments SET paypal_order_id=...
    PS-->>PC: {paypalOrderId}
    PC-->>BFF: {paypalOrderId}
    BFF-->>C: render PayPal JS SDK button with orderId

    C->>PPGW: User clicks Pay button (PayPal popup)
    PPGW-->>C: user approves

    C->>BFF: POST /api/payment/paypal/capture {paypalOrderId, orderNumber}
    BFF->>PC: POST /api/v1/payment/paypal/capture-order
    PC->>PS: capturePayment(paypalOrderId, orderNumber, user)
    PS->>PPGW: POST /v2/checkout/orders/id/capture
    PPGW-->>PS: {status: COMPLETED, capture: {id, amount, payer}}
    PS->>JT: INSERT payment_webhook_events (idempotency key = captureId)
    alt duplicate
        PS-->>PC: 200 already processed
    else first time
        PS->>JT: UPDATE payments SET status=paid, paypal_order_id, paypal_capture_id, payer_email
        PS->>JT: UPDATE orders SET payment_status=paid
        Note over PS: BUG — inventoryReservationService.confirmByOrderNumber() NOT called
        PS->>CS: redeemCouponForPaidOrder(orderId)
        PS->>MQ: publish order.paid.email event
        PS->>MQ: publish order.status.changed event
        PS-->>PC: 200 OK
    end
    PC-->>BFF: 200 OK
    BFF-->>C: payment successful page
```
