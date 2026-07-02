package com.bizkart.service;

import com.bizkart.model.Coupon;
import com.bizkart.model.CustomerAccount;
import com.bizkart.repository.CouponRepository;
import com.bizkart.repository.OnlineOrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class CouponService {

    private final CouponRepository couponRepo;
    private final OnlineOrderRepository orderRepo;

    public CouponService(CouponRepository couponRepo, OnlineOrderRepository orderRepo) {
        this.couponRepo = couponRepo;
        this.orderRepo  = orderRepo;
    }

    /** Admin: list all coupons */
    public List<Coupon> listAll() { return couponRepo.findAll(); }

    /** Admin: list active coupons */
    public List<Coupon> listActive() { return couponRepo.findByActiveTrue(); }

    /** Admin: create coupon */
    @Transactional
    public Coupon create(Coupon coupon) {
        coupon.setCode(coupon.getCode().toUpperCase().trim());
        return couponRepo.save(coupon);
    }

    /** Admin: update coupon */
    @Transactional
    public Coupon update(Long id, Coupon patch) {
        Coupon c = couponRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Coupon not found"));
        if (patch.getCode()          != null) c.setCode(patch.getCode().toUpperCase().trim());
        if (patch.getDescription()   != null) c.setDescription(patch.getDescription());
        if (patch.getDiscountType()  != null) c.setDiscountType(patch.getDiscountType());
        if (patch.getDiscountValue() != null) c.setDiscountValue(patch.getDiscountValue());
        if (patch.getMinOrderValue() != null) c.setMinOrderValue(patch.getMinOrderValue());
        if (patch.getMaxDiscount()   != null) c.setMaxDiscount(patch.getMaxDiscount());
        if (patch.getUsageLimit()    != null) c.setUsageLimit(patch.getUsageLimit());
        if (patch.getValidFrom()     != null) c.setValidFrom(patch.getValidFrom());
        if (patch.getValidUntil()    != null) c.setValidUntil(patch.getValidUntil());
        c.setActive(patch.isActive());
        c.setFirstOrderOnly(patch.isFirstOrderOnly());
        return couponRepo.save(c);
    }

    /** Admin: toggle active */
    @Transactional
    public Coupon toggle(Long id) {
        Coupon c = couponRepo.findById(id).orElseThrow(() -> new RuntimeException("Coupon not found"));
        c.setActive(!c.isActive());
        return couponRepo.save(c);
    }

    /** Portal: validate and compute discount for given order subtotal */
    public Map<String, Object> validateAndCompute(String code, BigDecimal subtotal,
                                                   Long shopId, CustomerAccount customer) {
        Coupon c = couponRepo.findByCodeIgnoreCase(code)
            .orElseThrow(() -> new RuntimeException("Invalid coupon code"));

        if (!c.isActive())
            throw new RuntimeException("Coupon is no longer active");

        LocalDateTime now = LocalDateTime.now();
        if (c.getValidFrom()  != null && now.isBefore(c.getValidFrom()))
            throw new RuntimeException("Coupon is not yet valid");
        if (c.getValidUntil() != null && now.isAfter(c.getValidUntil()))
            throw new RuntimeException("Coupon has expired");

        if (c.getUsageLimit() != null && c.getUsedCount() >= c.getUsageLimit())
            throw new RuntimeException("Coupon usage limit reached");

        if (subtotal.compareTo(c.getMinOrderValue()) < 0)
            throw new RuntimeException(
                String.format("Minimum order value ₹%.0f required for this coupon",
                    c.getMinOrderValue().doubleValue()));

        if (c.getShop() != null && !c.getShop().getId().equals(shopId))
            throw new RuntimeException("Coupon not valid for this shop");

        if (c.isFirstOrderOnly()) {
            long prevOrders = orderRepo.countByCustomerAccountId(customer.getId());
            if (prevOrders > 0)
                throw new RuntimeException("This coupon is only for first-time orders");
        }

        BigDecimal discount;
        if (c.getDiscountType() == Coupon.DiscountType.PERCENT) {
            discount = subtotal.multiply(c.getDiscountValue())
                               .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            if (c.getMaxDiscount() != null && discount.compareTo(c.getMaxDiscount()) > 0)
                discount = c.getMaxDiscount();
        } else {
            discount = c.getDiscountValue().min(subtotal);
        }

        return Map.of(
            "couponId",   c.getId(),
            "code",       c.getCode(),
            "discount",   discount,
            "description", c.getDescription() != null ? c.getDescription() : ""
        );
    }

    /** Called after order placed – increment usage */
    @Transactional
    public void recordUsage(String code) {
        couponRepo.findByCodeIgnoreCase(code).ifPresent(c -> {
            c.setUsedCount(c.getUsedCount() + 1);
            couponRepo.save(c);
        });
    }

    /** Portal: list active coupons visible for a shop */
    public List<Coupon> listForShop(Long shopId) {
        return couponRepo.findActiveForShop(shopId);
    }
}
