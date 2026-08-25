# Payment Processing Activity Diagram

This diagram represents the payment integrations (VNPay, MoMo, PayPal, COD) based on `VnpayPaymentController`, `VnpayPaymentServiceImpl`, `MomoPaymentController`, `MomoPaymentServiceImpl`, `PayPalPaymentController`, and `PayPalPaymentServiceImpl`.

```mermaid
flowchart TD
    Start([Start]) --> SelectProvider{Payment Provider}

    %% COD FLOW
    SelectProvider -->|Cash On Delivery COD| COD1[Order created with paymentMethod='cod']
    COD1 --> COD2[Payment record initialized with provider='manual', status='pending']
    COD2 --> COD3[Inventory reservation immediately confirmed]
    COD3 --> EndCOD([End COD Initial State])

    %% VNPAY FLOW
    SelectProvider -->|VNPay| VNP1[VNPay sends IPN request: GET /api/payments/vnpay/ipn or POST]
    VNP1 --> VNPSig{HMAC-SHA512 Signature Valid?}
    VNPSig -->|No| VNPErrSig[Return RspCode 97: Invalid Signature]
    VNPErrSig --> EndVNPSig([End])
    VNPSig -->|Yes| VNPOrder{Order exists in DB?}
    VNPOrder -->|No| VNPErrOrder[Return RspCode 01: Order Not Found]
    VNPErrOrder --> EndVNPOrder([End])
    VNPOrder -->|Yes| VNPPaidCheck{Order already paid/processed?}
    VNPPaidCheck -->|Yes| VNPAlready[Return RspCode 02: Order Already Confirmed]
    VNPAlready --> EndVNPAlready([End])
    VNPPaidCheck -->|No| VNPIdem{Idempotency insert payment_webhook_events successful?}
    VNPIdem -->|No - Duplicate| VNPAlready
    VNPIdem -->|Yes| VNPStatus{vnp_ResponseCode == '00' & vnp_TransactionStatus == '00'?}
    VNPStatus -->|Yes - Success| VNPPass[UPDATE orders & payments status to 'paid']
    VNPPass --> VNPConf[Confirm inventory reservation, redeem coupon & send notification email]
    VNPConf --> VNPPub[Publish OrderStatusChangedEvent]
    VNPPub --> VNPRespSuccess[Return RspCode 00: Confirm Success]
    VNPRespSuccess --> EndVNP([End])
    VNPStatus -->|No - Failed| VNPFail[UPDATE orders status to 'cancelled' & payments status to 'failed']
    VNPFail --> VNPRel[Release inventory reservation]
    VNPRel --> VNPPubFail[Publish OrderStatusChangedEvent]
    VNPPubFail --> VNPRespFail[Return RspCode 00: Processed Failure]
    VNPRespFail --> EndVNPFail([End])

    %% MOMO FLOW
    SelectProvider -->|MoMo| MOMO1[MoMo sends IPN: POST /api/payments/momo/ipn]
    MOMO1 --> MOMOSig{HMAC-SHA256 Signature Valid?}
    MOMOSig -->|No| MOMOIgnore[Log warning & return 204 No Content]
    MOMOIgnore --> EndMOMOSig([End])
    MOMOSig -->|Yes| MOMOAmount{Converted VND amount matches DB total?}
    MOMOAmount -->|No| MOMOMismatch[Log amount mismatch & return 204 No Content]
    MOMOMismatch --> EndMOMOAmount([End])
    MOMOAmount -->|Yes| MOMOIdem{Idempotency insert payment_webhook_events successful?}
    MOMOIdem -->|No - Duplicate| MOMODup[Return 204 No Content]
    MOMODup --> EndMOMODup([End])
    MOMOIdem -->|Yes| MOMOStatus{resultCode == 0?}
    MOMOStatus -->|Yes - Success| MOMOPass[UPDATE orders & payments status to 'paid']
    MOMOPass --> MOMOConf[Confirm inventory reservation, redeem coupon & send notification email]
    MOMOConf --> MOMOPub[Publish OrderStatusChangedEvent & return 204 No Content]
    MOMOPub --> EndMOMO([End])
    MOMOStatus -->|No - Failed| MOMOFail[UPDATE orders status to 'cancelled' & payments status to 'failed']
    MOMOFail --> MOMORel[Release inventory reservation]
    MOMORel --> MOMOPubFail[Publish OrderStatusChangedEvent & return 204 No Content]
    MOMOPubFail --> EndMOMOFail([End])

    %% PAYPAL FLOW
    SelectProvider -->|PayPal| PPStep{PayPal Step}

    PPStep -->|1. Create Order| PPCreate[POST /api/payments/paypal/create-order]
    PPCreate --> PPCallCreate[Call PayPal API server-to-server OrdersCreateRequest]
    PPCallCreate --> PPReturn[Return PayPal Order ID to client for SDK approval]
    PPReturn --> EndPPCreate([End])

    PPStep -->|2. Capture Order| PPCap[POST /api/payments/paypal/capture-order with paypalOrderId]
    PPCap --> PPOwnCheck{Order owned by authenticated User email?}
    PPOwnCheck -->|No| PPErr1[Throw BusinessException 403: Access Denied]
    PPErr1 --> EndPPErr1([End])
    PPOwnCheck -->|Yes| PPIdem{Idempotency insert payment_webhook_events successful?}
    PPIdem -->|No - Duplicate| PPErr2[Throw BusinessException 400: Payment already processed]
    PPErr2 --> EndPPErr2([End])
    PPIdem -->|Yes| PPCallCap[Call PayPal SDK OrdersCaptureRequest]
    PPCallCap --> PPAmountCheck{Captured amount matches DB order total?}
    PPAmountCheck -->|No| PPMismatch[Mark paid = false]
    PPAmountCheck -->|Yes| PPStatusCheck{captureStatus == 'COMPLETED'?}
    PPStatusCheck -->|Yes| PPPass[UPDATE orders & payments status to 'paid']
    PPPass --> PPConf[Redeem coupon & send notification email]
    PPConf --> PPPub[Publish OrderStatusChangedEvent]
    PPPub --> PPRespPass[Return PayPalCaptureResponse: status='paid']
    PPRespPass --> EndPPPass([End])
    PPStatusCheck -->|No| PPFail[UPDATE orders status to 'cancelled' & payments status to 'failed']
    PPMismatch --> PPFail
    PPFail --> PPPubFail[Publish OrderStatusChangedEvent]
    PPPubFail --> PPRespFail[Return PayPalCaptureResponse: status='failed']
    PPRespFail --> EndPPFail([End])
```
