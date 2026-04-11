package com.example.shop.modules.cart.repository;

import com.example.shop.modules.cart.entity.CartItem;
import com.example.shop.modules.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {

    List<CartItem> findByUser(User user);

    Optional<CartItem> findByUserAndProductID(User user, String productID);

    void deleteByUserAndProductID(User user, String productID);

    void deleteByUser(User user);

    @Query("select c.productID as productID, sum(c.quantity) as reservedQty from CartItem c group by c.productID")
    List<CartReservedStockProjection> summarizeReservedQuantities();

    @Query("select c.productID as productID, sum(c.quantity) as reservedQty from CartItem c where c.productID in :productIDs group by c.productID")
    List<CartReservedStockProjection> summarizeReservedQuantitiesByProductIDs(@Param("productIDs") List<String> productIDs);

    @Query("select coalesce(sum(c.quantity), 0) from CartItem c where c.productID = :productID")
    Integer sumReservedQuantityByProductID(@Param("productID") String productID);
}
