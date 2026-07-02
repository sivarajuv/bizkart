package com.bizkart.repository;

import com.bizkart.model.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {
    Optional<Coupon> findByCodeIgnoreCase(String code);
    List<Coupon> findByActiveTrue();

    @Query("SELECT c FROM Coupon c WHERE c.active = true AND (c.shop IS NULL OR c.shop.id = :shopId)")
    List<Coupon> findActiveForShop(@Param("shopId") Long shopId);
}
