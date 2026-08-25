# Wishlist Sequence Diagram

This sequence diagram details the runtime interactions for View Wishlist, Add to Wishlist (Snapshot Upsert), and Remove from Wishlist across `WishlistController`, `WishlistServiceImpl`, and `WishlistItemRepository`.

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated User
    participant WC as WishlistController
    participant WS as WishlistServiceImpl
    participant WR as WishlistItemRepository

    %% GET WISHLIST
    rect rgb(240, 248, 255)
        note over User, WR: Get Wishlist Flow
        User->>WC: GET /api/wishlist
        WC->>WS: getWishlist(user)
        WS->>WR: findByUser(user)
        WR-->>WS: List<WishlistItem>
        WS->>WS: Map entities to WishlistItemDto list
        WS-->>WC: List<WishlistItemDto>
        WC-->>User: 200 OK (List<WishlistItemDto>)
    end

    %% ADD TO WISHLIST
    rect rgb(230, 255, 230)
        note over User, WR: Add to Wishlist Flow
        User->>WC: POST /api/wishlist (WishlistItemDto)
        WC->>WS: addToWishlist(user, dto)
        WS->>WR: findByUserAndProductID(user, dto.productID)
        alt WishlistItem Exists
            WR-->>WS: Optional.of(existingWishlistItem)
        else WishlistItem New
            WR-->>WS: Optional.empty()
            WS->>WS: Build WishlistItem entity (user, productID, productName, productPrice, productReviews)
        end
        WS->>WR: save(WishlistItem entity)
        WR-->>WS: savedWishlistItem
        WS->>WS: Map saved entity to WishlistItemDto
        WS-->>WC: WishlistItemDto
        WC-->>User: 200 OK (WishlistItemDto)
    end

    %% REMOVE FROM WISHLIST
    rect rgb(255, 240, 245)
        note over User, WR: Remove from Wishlist Flow
        User->>WC: DELETE /api/wishlist/{productID}
        WC->>WS: removeFromWishlist(user, productID)
        WS->>WR: deleteByUserAndProductID(user, productID)
        WR-->>WS: void
        WS-->>WC: void
        WC-->>User: 200 OK (SimpleMessageResponse: Removed from wishlist)
    end
```
