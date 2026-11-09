package com.example.shop.modules.resale.controller;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.resale.repository.SellerProductAllocationRepository;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import com.example.shop.modules.notification.service.CustomerNotificationService;
import java.util.*;

@RestController @RequestMapping("/api/v1/supplier/resale/allocations")
@PreAuthorize("hasRole('SUPPLIER')") @RequiredArgsConstructor
public class SupplierAllocationController {
    private final SellerProductAllocationRepository allocations;
    private final JdbcTemplate jdbc;
    private final CustomerNotificationService notifications;
    public record AllocationDto(UUID id, UUID listingId, String productId, String productName, UUID sellerId,
      String sellerName, int allocated, int sold, int reserved, int remaining, String status) {}
    public record UpdateAllocation(Integer allocatedQuantity, String reason) {}
    public record AuditDto(int previousQuantity, int newQuantity, UUID supplierUserId, String supplierName, String reason, java.time.LocalDateTime changedAt) {}

    @GetMapping @Transactional(readOnly = true)
    public List<AllocationDto> list(@AuthenticationPrincipal User actor) {
        if (actor == null || actor.getId() == null) throw new BusinessException("Supplier authentication required", HttpStatus.UNAUTHORIZED);
        return allocations.findAllForSupplier(actor.getId()).stream().map(this::toDto).toList();
    }
    @GetMapping("/{listingId}/history") public List<AuditDto> history(@PathVariable UUID listingId, @AuthenticationPrincipal User actor) {
        var allocation = allocations.findByListingId(listingId).orElseThrow(() -> new BusinessException("Allocation not found", HttpStatus.NOT_FOUND));
        requireOwner(allocation.getSupplierUserId(), actor);
        return jdbc.query("select a.previous_quantity,a.new_quantity,a.supplier_user_id,coalesce(nullif(trim(concat(u.first_name,' ',u.last_name)),''),u.email) supplier_name,a.reason,a.changed_at from seller_product_allocation_audit a join users u on u.users_id=a.supplier_user_id where a.allocation_id=? order by a.changed_at desc", (rs,n)->new AuditDto(rs.getInt("previous_quantity"),rs.getInt("new_quantity"),(UUID)rs.getObject("supplier_user_id"),rs.getString("supplier_name"),rs.getString("reason"),rs.getTimestamp("changed_at").toLocalDateTime()), allocation.getId());
    }
    @PutMapping("/{listingId}") @Transactional
    public AllocationDto update(@PathVariable UUID listingId, @RequestBody UpdateAllocation body, @AuthenticationPrincipal User actor) {
        if (body == null || body.allocatedQuantity() == null || body.allocatedQuantity() < 0) throw new BusinessException("Allocation must be zero or greater", HttpStatus.BAD_REQUEST);
        var a = allocations.findByListingId(listingId).orElseThrow(() -> new BusinessException("Allocation not found", HttpStatus.NOT_FOUND));
        requireOwner(a.getSupplierUserId(), actor);
        if (body.allocatedQuantity() < a.getSoldQuantity() + a.getReservedQuantity()) throw new BusinessException("Allocation cannot be below sold plus reserved quantity", HttpStatus.CONFLICT);
        Integer supplierAvailable = jdbc.queryForObject("select stock_quantity-reserved_quantity from supplier_products where id=? for update", Integer.class, a.getSupplierOffer().getId());
        Long otherCommitted = Optional.ofNullable(allocations.sumRemainingForOfferExcludingListing(a.getSupplierOffer().getId(), listingId)).orElse(0L);
        Long unlistedCommitment = Optional.ofNullable(jdbc.queryForObject("select coalesce(sum(initial_allocation_quantity),0) from seller_resale_authorizations z where z.supplier_user_id=? and z.supplier_offer_id=? and z.is_active=true and not exists(select 1 from seller_product_listings l where l.authorization_id=z.id)", Long.class, actor.getId(), a.getSupplierOffer().getId())).orElse(0L);
        long remainingCommitment = (long) body.allocatedQuantity() - a.getSoldQuantity();
        if (otherCommitted + unlistedCommitment + remainingCommitment > (supplierAvailable == null ? 0 : supplierAvailable)) throw new BusinessException("Total remaining allocations exceed unreserved supplier inventory", HttpStatus.CONFLICT);
        int old = a.getAllocatedQuantity();
        int changed = jdbc.update("update seller_product_allocations set allocated_quantity=?, updated_at=current_timestamp where id=? and allocated_quantity=? and sold_quantity + reserved_quantity <= ?", body.allocatedQuantity(), a.getId(), old, body.allocatedQuantity());
        if (changed != 1) throw new BusinessException("Allocation changed concurrently; reload and retry", HttpStatus.CONFLICT);
        jdbc.update("insert into seller_product_allocation_audit(allocation_id, previous_quantity, new_quantity, supplier_user_id, reason) values(?,?,?,?,?)", a.getId(), old, body.allocatedQuantity(), actor.getId(), body.reason());
        a.setAllocatedQuantity(body.allocatedQuantity());
        notifications.createForUser(a.getSellerUserId(), "allocation:" + a.getId() + ":" + System.currentTimeMillis(),
                "resale", "Seller allocation updated", "Your allocation for " + a.getSupplierOffer().getProduct().getProductName() +
                        " is now " + body.allocatedQuantity() + " units.", "/seller/listings", a.getId().toString());
        return new AllocationDto(a.getId(), listingId, a.getListing().getSupplierProductId(), a.getSupplierOffer().getProduct().getProductName(), a.getSellerUserId(), a.getListing().getSeller().getName(), a.getAllocatedQuantity(), a.getSoldQuantity(), a.getReservedQuantity(), a.remaining(), a.getStatus());
    }

    private void requireOwner(UUID supplierUserId, User actor) {
        if (actor == null || actor.getId() == null) throw new BusinessException("Supplier authentication required", HttpStatus.UNAUTHORIZED);
        if (!Objects.equals(supplierUserId, actor.getId())) throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
    }

    private AllocationDto toDto(com.example.shop.modules.resale.entity.SellerProductAllocation allocation) {
        Integer allocated = allocation.getAllocatedQuantity();
        Integer sold = allocation.getSoldQuantity();
        Integer reserved = allocation.getReservedQuantity();
        if (allocated == null || sold == null || reserved == null || allocated < 0 || sold < 0 || reserved < 0 || (long) sold + reserved > allocated) {
            throw new BusinessException("Stored allocation quantities are inconsistent", HttpStatus.CONFLICT);
        }
        var listing = allocation.getListing();
        var offer = allocation.getSupplierOffer();
        var product = offer == null ? null : offer.getProduct();
        var seller = listing == null ? null : listing.getSeller();
        return new AllocationDto(
                allocation.getId(),
                listing == null ? null : listing.getId(),
                listing == null ? null : listing.getSupplierProductId(),
                product == null ? null : product.getProductName(),
                allocation.getSellerUserId(),
                seller == null ? null : seller.getName(),
                allocated, sold, reserved, allocated - sold - reserved, allocation.getStatus());
    }
}
