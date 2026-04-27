package com.example.shop.modules.coupon.repository;

import com.example.shop.modules.coupon.entity.Coupon;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CouponRepository extends JpaRepository<Coupon, Long> {

    Optional<Coupon> findByCode(String code);

    @Query("SELECT c FROM Coupon c WHERE (:q IS NULL OR LOWER(c.code) LIKE :q OR LOWER(c.title) LIKE :q) ORDER BY c.createdAt DESC")
    Page<Coupon> searchCoupons(@Param("q") String q, Pageable pageable);
}
