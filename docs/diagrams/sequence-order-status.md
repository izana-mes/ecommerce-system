# Order Status Management Sequence Diagram

This sequence diagram details the runtime interactions for Customer Order Tracking, Admin/Shipper Status Updates, Role-Based Access Controls, and Shipper Notification Reminders across `AdminOrderController`, `OrderStatusController`, `OrderServiceImpl`, `FulfillmentNotificationService`, and RabbitMQ.

```mermaid
sequenceDiagram
    autonumber
    actor Actor as Customer / Admin / Shipper
    participant OC as OrderStatusController / AdminOrderController
    participant OS as OrderServiceImpl
    participant DB as Orders DB Table
    participant FNS as FulfillmentNotificationService
    participant MQ as OrderStatusChangedPublisher / RabbitMQ
    participant Email as EmailPublisher / Active Shippers

    %% CUSTOMER ORDER TRACKING
    rect rgb(240, 248, 255)
        note over Actor, DB: Customer Order Tracking Flow
        Actor->>OC: GET /api/orders/track?secret={trackingSecret}
        OC->>OS: trackOrder(trackingSecret)
        OS->>DB: findByTrackingSecret(trackingSecret)
        alt Order Not Found
            DB-->>OS: Optional.empty()
            OS-->>OC: throw BusinessException(404 Not Found)
            OC-->>Actor: 404 Not Found (Order not found)
        else Order Found
            DB-->>OS: Optional.of(order)
            OS->>DB: findOrderItemsByOrderId(order.id)
            DB-->>OS: List<OrderItem>
            OS-->>OC: OrderTrackingDto (orderNumber, status, paymentStatus, items, shippingTracking)
            OC-->>Actor: 200 OK (OrderTrackingDto)
        end
    end

    %% ADMIN / SHIPPER STATUS PATCH
    rect rgb(230, 255, 230)
        note over Actor, Email: Admin & Shipper Status Update Flow
        Actor->>OC: PATCH /api/v1/admin/orders/{id} (OrderStatusPatchRequest)
        OC->>DB: findById(id)
        alt Order Not Found
            DB-->>OC: return 404 Not Found
            OC-->>Actor: 404 Not Found
        else Order Found
            DB-->>OC: order
            alt Target Status is 'shipped' AND Order already completed or cancelled
                OC-->>Actor: return 409 Conflict (Cannot mark terminal order as shipped)
            else Valid Status Transition
                alt Actor Role == ROLE_SHIPPER or ROLE_EMPLOYEE
                    opt Order Status != 'shipped' OR Payment Status is non-null
                        OC-->>Actor: return 403 Forbidden (Shippers can only update status to shipped)
                    end
                    opt Order is not prepaid/paid OR COD pending/processing
                        OC-->>Actor: return 403 Forbidden (Shipper cannot ship unpaid non-COD order)
                    end
                    opt trackingNumber or carrier missing
                        OC-->>Actor: return 400 Bad Request (Carrier & tracking required for shipping)
                    end
                end
                OC->>DB: UPDATE orders SET order_status, payment_status, shipping_carrier, tracking_number
                DB-->>OC: updatedOrder
                OC->>MQ: publish(OrderStatusChangedEvent: oldStatus -> newStatus)
                opt Order Paid for 2+ Days & Not Completed
                    OC->>FNS: notifyShippersOrderPaid(orderId, orderNumber, customerEmail)
                    FNS->>Email: Send HTML email alert to active ROLE_SHIPPER users
                end
                OC-->>Actor: 200 OK (Updated Order Entity)
            end
        end
    end
```
