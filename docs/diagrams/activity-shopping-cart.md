# Shopping Cart Activity Diagram

This diagram represents the shopping cart management workflow based on `CartController`, `CartServiceImpl`, `CartItemRepository`, and `CartAbandonmentReminderService`.

```mermaid
flowchart TD
    Start([Start]) --> ActionChoice{Cart Action}

    %% GET CART
    ActionChoice -->|Get Cart| G1[GET /api/cart]
    G1 --> GFetch[Fetch cart_items by authenticated User]
    GFetch --> GJoin[Fetch matching Product catalog entries]
    GJoin --> GMap[Map to CartItemDto with availableStock & purchasable flag]
    GMap --> GResp[Return list of CartItemDto]
    GResp --> EndG([End])

    %% ADD TO CART
    ActionChoice -->|Add to Cart| A1[POST /api/cart with productID]
    A1 --> ACheckBlank{productID non-blank?}
    ACheckBlank -->|No| AErr1[Throw BusinessException 400: productID is required]
    AErr1 --> EndAErr1([End])
    ACheckBlank -->|Yes| AProdCheck{Product exists in DB?}
    AProdCheck -->|No| AErr2[Throw BusinessException 404: Product not found]
    AErr2 --> EndAErr2([End])
    AProdCheck -->|Yes| AActiveCheck{product.active == true?}
    AActiveCheck -->|No| AErr3[Throw BusinessException 409: Product is inactive]
    AErr3 --> EndAErr3([End])
    AActiveCheck -->|Yes| AStockCheck{product.stockQuantity > 0?}
    AStockCheck -->|No| AErr4[Throw BusinessException 409: Product is out of stock]
    AErr4 --> EndAErr4([End])
    AStockCheck -->|Yes| ACalcMax[Compute maxAllowedByStock = min 20, stockQuantity]
    ACalcMax --> AFindCart{CartItem already exists for User & Product?}
    AFindCart -->|Yes| AGotOwn[ownQty = item.quantity]
    AFindCart -->|No| AZeroOwn[ownQty = 0]
    AGotOwn --> ACalcNew[newQty = ownQty + 1]
    AZeroOwn --> ACalcNew
    ACalcNew --> ACheckCap{newQty > maxAllowedByStock?}
    ACheckCap -->|Yes| AErr5[Throw BusinessException 409: Cannot exceed available stock]
    AErr5 --> EndAErr5([End])
    ACheckCap -->|No| ASave[Upsert CartItem entity in DB]
    ASave --> AEvict[Evict Redis Caches: PRODUCTS_INVENTORY_HEALTH, ADMIN_DASHBOARD, etc.]
    AEvict --> AResp[Return CartAddResponse]
    AResp --> EndA([End])

    %% UPDATE QUANTITY
    ActionChoice -->|Update Quantity| U1[PUT /api/cart/productID with quantity]
    U1 --> UNullCheck{quantity == null?}
    UNullCheck -->|Yes| UErr1[Throw IllegalStateException: Quantity is required]
    UErr1 --> EndUErr1([End])
    UNullCheck -->|No| UZeroCheck{quantity <= 0?}
    UZeroCheck -->|Yes| UDel[Find CartItem & delete from DB]
    UDel --> UEvict
    UZeroCheck -->|No| UFindItem{CartItem exists for User & Product?}
    UFindItem -->|No| UErr2[Throw BusinessException 404: Cart item not found]
    UErr2 --> EndUErr2([End])
    UFindItem -->|Yes| UProdCheck[Fetch Product & compute maxAllowedByStock]
    UProdCheck --> UStockCheck{maxAllowedByStock > 0?}
    UStockCheck -->|No| UErr3[Throw BusinessException 409: Product is out of stock]
    UErr3 --> EndUErr3([End])
    UStockCheck -->|Yes| UCapCheck{requested quantity > maxAllowedByStock?}
    UCapCheck -->|Yes| UErr4[Throw BusinessException 409: Only N item s left in stock]
    UErr4 --> EndUErr4([End])
    UCapCheck -->|No| USave[Update CartItem quantity & save]
    USave --> UEvict
    UEvict --> UResp[Return updated CartItemDto]
    UResp --> EndU([End])

    %% REMOVE FROM CART
    ActionChoice -->|Remove Item| R1[DELETE /api/cart/productID]
    R1 --> RDel[Delete CartItem by User & Product ID]
    RDel --> REvict[Evict Redis Caches]
    REvict --> RResp[Return success message]
    RResp --> EndR([End])

    %% CLEAR CART
    ActionChoice -->|Clear Cart| C1[DELETE /api/cart/clear]
    C1 --> CDel[Delete all CartItems for User]
    CDel --> CEvict[Evict Redis Caches]
    CEvict --> CResp[Return success message]
    CResp --> EndC([End])

    %% CHECKOUT HEALTH
    ActionChoice -->|Checkout Health| H1[GET /api/cart/checkout-health]
    H1 --> HFetch[Fetch all CartItems for User & join Products]
    HFetch --> HCheck[Validate each item: exists, active, stock > 0, quantity <= stock]
    HCheck --> HHealthResp[Build CartCheckoutHealthResponseDto with invalidItems list]
    HHealthResp --> EndH([End])
```
