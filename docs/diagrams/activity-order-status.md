# Order Status Management Activity Diagram

This diagram represents the order status tracking and admin update workflow based on `AdminOrderController`, `OrderStatusController`, `OrderServiceImpl`, and `FulfillmentNotificationService`.

```mermaid
flowchart TD
    Start([Start]) --> RoleCheck{Actor & Endpoint?}

    %% CUSTOMER / PUBLIC TRACKING
    RoleCheck -->|Customer View / Track| T1[GET /api/orders/track or GET /api/orders/my-orders]
    T1 --> TFetch[Fetch order details, items, shipment tracking]
    TFetch --> TResp[Return OrderTrackingDto / OrderHistoryItemDto]
    TResp --> EndT([End])

    %% ADMIN / STAFF ORDER UPDATE
    RoleCheck -->|Admin / Employee / Shipper Patch| P1[PATCH /api/v1/admin/orders/id]
    P1 --> PFind{Order exists in DB?}
    PFind -->|No| PErr404[Return 404 Not Found]
    PErr404 --> EndP404([End])
    PFind -->|Yes| PStateCheck{Is order in terminal state completed/cancelled AND new status == shipped?}
    PStateCheck -->|Yes| PErr409[Return 409 Conflict: Cannot mark terminal order as shipped]
    PErr409 --> EndP409([End])
    PStateCheck -->|No| PParamCheck{orderStatus or paymentStatus provided?}
    PParamCheck -->|No status & non-admin| PErr400[Return 400 Bad Request: Status payload required]
    PErr400 --> EndP400([End])
    PParamCheck -->|Yes| PRoleRestrict{Actor Role?}

    %% SHIPPER / EMPLOYEE RESTRICTIONS
    PRoleRestrict -->|SHIPPER / EMPLOYEE| SCheckStatus{orderStatus == 'shipped' AND paymentStatus is null?}
    SCheckStatus -->|No| SErr403[Return 403 Forbidden: Shippers can only mark order as shipped]
    SErr403 --> EndS403([End])
    SCheckStatus -->|Yes| SCheckPrepaid{Order is prepaid/paid OR COD in pending/processing?}
    SCheckPrepaid -->|No| SErr403
    SCheckPrepaid -->|Yes| SCheckShipDetails{trackingNumber & carrier provided?}
    SCheckShipDetails -->|No| SErr400[Return 400 Bad Request: Carrier & tracking required for shipping]
    SErr400 --> EndS400([End])
    SCheckShipDetails -->|Yes| PUpdateDB

    %% ADMIN UNRESTRICTED
    PRoleRestrict -->|ADMIN| PValEnums{orderStatus in valid set AND paymentStatus in valid set?}
    PValEnums -->|No| PErrInvalidEnum[Return 400 Bad Request: Invalid status enum value]
    PErrInvalidEnum --> EndPEnum([End])
    PValEnums -->|Yes| PUpdateDB

    %% DB UPDATE & NOTIFICATION
    PUpdateDB[UPDATE orders SET order_status, payment_status, shipping info in DB]
    PUpdateDB --> PEvent[Publish OrderStatusChangedEvent to RabbitMQ]
    PEvent --> PRemindCheck{Order paid for 2+ days and not completed?}
    PRemindCheck -->|Yes| PNotifyShipper[FulfillmentNotificationService sends reminder email to active shippers]
    PRemindCheck -->|No| PResp
    PNotifyShipper --> PResp[Return 200 OK with updated Order entity]
    PResp --> EndP([End])
```
