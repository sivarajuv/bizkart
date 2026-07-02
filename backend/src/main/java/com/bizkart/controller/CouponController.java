package com.bizkart.controller;

import com.bizkart.model.Coupon;
import com.bizkart.model.CustomerAccount;
import com.bizkart.repository.CustomerAccountRepository;
import com.bizkart.security.JwtUtils;
import com.bizkart.service.CouponService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
public class CouponController {

    private final CouponService couponService;
    private final JwtUtils jwtUtils;
    private final CustomerAccountRepository customerRepo;

    public CouponController(CouponService couponService, JwtUtils jwtUtils,
                            CustomerAccountRepository customerRepo) {
        this.couponService = couponService;
        this.jwtUtils      = jwtUtils;
        this.customerRepo  = customerRepo;
    }

    // ── Admin endpoints ──────────────────────────────────────────────────

    @GetMapping("/api/admin/coupons")
    public ResponseEntity<?> listAll() {
        return ResponseEntity.ok(couponService.listAll());
    }

    @PostMapping("/api/admin/coupons")
    public ResponseEntity<?> create(@RequestBody Coupon coupon) {
        try {
            return ResponseEntity.ok(couponService.create(coupon));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/api/admin/coupons/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Coupon patch) {
        try {
            return ResponseEntity.ok(couponService.update(id, patch));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/api/admin/coupons/{id}/toggle")
    public ResponseEntity<?> toggle(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(couponService.toggle(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Portal endpoints ──────────────────────────────────────────────────

    /** List active coupons for a shop (public) */
    @GetMapping("/api/portal/coupons")
    public ResponseEntity<?> listForShop(@RequestParam Long shopId) {
        return ResponseEntity.ok(couponService.listForShop(shopId));
    }

    /** Validate coupon code and preview discount (auth) */
    @PostMapping("/api/portal/coupons/apply")
    public ResponseEntity<?> applyCoupon(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody Map<String, Object> body
    ) {
        try {
            Long customerId = jwtUtils.getCustomerIdFromToken(authHeader.replace("Bearer ", ""));
            CustomerAccount customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Customer not found"));
            String code    = (String) body.get("code");
            BigDecimal sub = new BigDecimal(body.get("subtotal").toString());
            Long shopId    = Long.parseLong(body.get("shopId").toString());
            return ResponseEntity.ok(couponService.validateAndCompute(code, sub, shopId, customer));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
