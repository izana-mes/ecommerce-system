package com.example.shop.modules.coupon.repository;

import com.example.shop.modules.coupon.entity.CouponAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CouponAssignmentRepository extends JpaRepository<CouponAssignment, Long> {

    long countByCouponId(Long couponId);

    @Query("SELECT ca FROM CouponAssignment ca WHERE ca.coupon.id = :couponId AND ca.userId = :userId ORDER BY CASE WHEN ca.usedAt IS NULL THEN 0 ELSE 1 END, ca.issuedAt DESC")
    List<CouponAssignment> findByCouponIdAndUserIdOrderByIssuedAtDesc(@Param("couponId") Long couponId, @Param("userId") String userId);

    @Query("SELECT ca FROM CouponAssignment ca JOIN FETCH ca.coupon WHERE ca.userId = :userId ORDER BY ca.issuedAt DESC")
    List<CouponAssignment> findByUserIdWithCoupon(@Param("userId") String userId);
}
