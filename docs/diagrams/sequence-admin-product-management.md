# Admin Product Management Sequence Diagram

This sequence diagram details the runtime interactions for Admin Product CRUD operations, non-admin Change Request submissions, and Inventory Health reporting across `ProductController`, `ProductServiceImpl`, `ProductRepository`, `CartItemRepository`, and `CacheInvalidationEventPublisher`.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin / Employee / Supplier / Seller
    participant PC as ProductController
    participant PS as ProductServiceImpl
    participant PR as ProductRepository
    participant PM as ProductMapper
    participant CR as ProductChangeRequestService
    participant CRR as ProductChangeRequestRepository
    participant CRepo as CartItemRepository
    participant Cache as CacheInvalidationEventPublisher / Redis
    participant AL as AdminAuditLogger

    %% DIRECT CREATE (ADMIN) vs CHANGE REQUEST (NON-ADMIN)
    rect rgb(240, 248, 255)
        note over Admin, CRR: Product Creation Flow
        Admin->>PC: POST /api/products/single (ProductDto)
        alt Role == ROLE_ADMIN
            PC->>PS: createProduct(ProductDto)
            PS->>PR: findByProductID(dto.productID)
            alt Product ID Exists
                PR-->>PS: Optional.of(existingProduct)
                PS-->>PC: throw IllegalArgumentException("Product already exists")
                PC-->>Admin: 400 Bad Request / 409 Conflict
            else Product ID Available
                PR-->>PS: Optional.empty()
                PS->>PM: toEntity(dto)
                PM-->>PS: entity
                PS->>PR: save(entity with stock & category defaults)
                PR-->>PS: savedProduct
                PS->>Cache: publish(evict PRODUCTS_ALL, SEARCH, SUGGEST, INVENTORY_HEALTH, ADMIN_DASHBOARD)
                PS->>PM: toDto(savedProduct)
                PM-->>PS: resultDto
                PS-->>PC: resultDto
                PC->>AL: log("PRODUCT_CREATE", adminEmail, metadata)
                PC-->>Admin: 200 OK (ProductDto)
            end
        else Role == EMPLOYEE / SUPPLIER / SELLER
            PC->>CR: createChangeRequest(dto, actor)
            CR->>CRR: save(ProductChangeRequest: status=PENDING)
            CRR-->>CR: savedRequest
            CR-->>PC: savedRequest
            PC-->>Admin: 202 Accepted (Change Request Submitted)
        end
    end

    %% ADMIN APPROVAL OF CHANGE REQUEST
    rect rgb(245, 245, 220)
        note over Admin, Cache: Admin Review & Approval Flow
        Admin->>PC: POST /api/products/change-requests/{id}/approve
        PC->>CR: approveRequest(id, adminNote)
        CR->>PR: findByProductID(productId)
        alt Product New
            CR->>PR: save(new Product)
            opt Has Supplier or Seller ID
                CR->>PS: assignSupplierToProduct / assignSellerToProduct
                PS->>PR: save(product with supplier/seller ID)
            end
        else Product Existing Update
            CR->>PR: save(updated Product)
        end
        CR->>Cache: publishCacheInvalidation()
        CR-->>PC: approvedRequest
        PC-->>Admin: 200 OK (Request Approved)
    end

    %% DIRECT UPDATE (ADMIN)
    rect rgb(230, 255, 230)
        note over Admin, AL: Product Update Flow
        Admin->>PC: PUT /api/products/{productID} (ProductDto)
        alt Role == ROLE_ADMIN
            PC->>PS: updateProduct(productID, ProductDto)
            PS->>PR: findByProductID(productID)
            alt Product Not Found
                PR-->>PS: Optional.empty()
                PS-->>PC: throw IllegalArgumentException("Product not found")
                PC-->>Admin: 400 Bad Request
            else Product Found
                PR-->>PS: Optional.of(existingProduct)
                opt Price Changed
                    PS->>PS: set oldPrice = previous productPrice
                end
                PS->>PR: save(updated Product entity)
                PR-->>PS: savedProduct
                PS->>Cache: publishCacheInvalidation()
                PS->>PM: toDto(savedProduct)
                PM-->>PS: resultDto
                PS-->>PC: resultDto
                PC->>AL: log("PRODUCT_UPDATE", adminEmail, metadata)
                PC-->>Admin: 200 OK (ProductDto)
            end
        end
    end

    %% DIRECT DELETE (ADMIN)
    rect rgb(255, 240, 245)
        note over Admin, AL: Product Deletion Flow
        Admin->>PC: DELETE /api/products/{productID}
        alt Role == ROLE_ADMIN
            PC->>PS: deleteProduct(productID)
            PS->>PR: findByProductID(productID)
            alt Product Not Found
                PR-->>PS: Optional.empty()
                PS-->>PC: throw IllegalArgumentException("Product not found")
                PC-->>Admin: 400 Bad Request
            else Product Found
                PR-->>PS: Optional.of(existingProduct)
                PS->>PR: delete(existingProduct)
                PS->>Cache: publishCacheInvalidation()
                PS-->>PC: void
                PC->>AL: log("PRODUCT_DELETE", adminEmail, metadata)
                PC-->>Admin: 200 OK (Product Deleted)
            end
        end
    end

    %% INVENTORY HEALTH REPORT
    rect rgb(240, 240, 240)
        note over Admin, CRepo: Inventory Health Flow
        Admin->>PC: GET /api/products/inventory-health?lowStockThreshold=5
        PC->>PS: getInventoryHealth(5)
        PS->>PR: findAllByOrderByIdAsc()
        PR-->>PS: allProducts List
        PS->>CRepo: summarizeReservedQuantities()
        CRepo-->>PS: cartReservedMap
        PS->>PS: calculate lowStockItems & outOfStockItems (stock - cartReserved)
        PS-->>PC: Map<String, Object> (inventoryHealthStats)
        PC-->>Admin: 200 OK (Inventory Health Data)
    end
```
