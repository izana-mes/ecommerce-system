package com.example.shop.modules.resale.repository;
import com.example.shop.modules.resale.entity.SellerProductAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface SellerProductAllocationRepository extends JpaRepository<SellerProductAllocation, UUID> {
    @Query("select a from SellerProductAllocation a join fetch a.listing l join fetch a.supplierOffer o join fetch o.product p where a.sellerUserId=:seller and a.status='ACTIVE' order by a.createdAt desc")
    List<SellerProductAllocation> findActiveForSeller(@Param("seller") UUID sellerId);
    @Query("select coalesce(sum(a.allocatedQuantity),0) from SellerProductAllocation a where a.supplierOffer.id=:offer")
    Long sumAllocatedForOffer(@Param("offer") UUID offerId);
    @Query("select coalesce(sum(a.allocatedQuantity-a.soldQuantity),0) from SellerProductAllocation a where a.supplierOffer.id=:offer")
    Long sumRemainingForOffer(@Param("offer") UUID offerId);
    @Query("select coalesce(sum(a.allocatedQuantity-a.soldQuantity),0) from SellerProductAllocation a where a.supplierOffer.id=:offer and a.listing.id<>:listing")
    Long sumRemainingForOfferExcludingListing(@Param("offer") UUID offerId, @Param("listing") UUID listingId);
    @Query("select a from SellerProductAllocation a " +
            "left join fetch a.listing l " +
            "left join fetch l.seller seller " +
            "left join fetch a.supplierOffer o " +
            "left join fetch o.product product " +
            "where a.supplierUserId=:supplier order by a.createdAt desc")
    List<SellerProductAllocation> findAllForSupplier(@Param("supplier") UUID supplier);
    Optional<SellerProductAllocation> findByListingId(UUID listingId);
}
