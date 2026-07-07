package com.bizkart.controller;

import com.bizkart.model.OnlineOrder;
import com.bizkart.service.CurrentUserService;
import com.bizkart.service.OnlineOrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/shop-orders")
public class ShopOrderManagementController {

    private final OnlineOrderService orderService;
    private final CurrentUserService currentUserService;

    public ShopOrderManagementController(
        OnlineOrderService orderService,
        CurrentUserService currentUserService
    ) {
        this.orderService       = orderService;
        this.currentUserService = currentUserService;
    }

    /** Active (in-progress) orders for the logged-in shop */
    @GetMapping("/active")
    public ResponseEntity<?> getActiveOrders(Authentication auth) {
        try {
            Long shopId = currentUserService
                .requireShop(currentUserService.requireUser(auth)).getId();
            return ResponseEntity.ok(orderService.getActiveOrdersForShop(shopId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** All orders (history + active) for the logged-in shop */
    @GetMapping
    public ResponseEntity<?> getAllOrders(Authentication auth) {
        try {
            Long shopId = currentUserService
                .requireShop(currentUserService.requireUser(auth)).getId();
            return ResponseEntity.ok(orderService.getAllOrdersForShop(shopId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Advance or update order status */
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
        Authentication auth,
        @PathVariable Long id,
        @RequestBody Map<String, String> body
    ) {
        try {
            Long userId = currentUserService.requireUser(auth).getId();
            OnlineOrder.OrderStatus newStatus =
                OnlineOrder.OrderStatus.valueOf(body.get("status"));
            String note = body.getOrDefault("note", "");
            return ResponseEntity.ok(
                orderService.updateStatus(id, newStatus, userId, note)
            );
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid status value"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Apply a manual discount to an order's total — percent or flat rupee
     * amount. Body: { "type": "PERCENT"|"FLAT", "value": number }.
     * Send { "type": null, "value": null } (or omit both) to clear it.
     */
    @PatchMapping("/{id}/discount")
    public ResponseEntity<?> applyDiscount(
        @PathVariable Long id,
        @RequestBody Map<String, Object> body
    ) {
        try {
            String typeStr = (String) body.get("type");
            Object valueObj = body.get("value");

            OnlineOrder.ManualDiscountType type = (typeStr == null || typeStr.isBlank())
                ? null : OnlineOrder.ManualDiscountType.valueOf(typeStr);
            BigDecimal value = valueObj == null
                ? null : new BigDecimal(valueObj.toString());

            return ResponseEntity.ok(orderService.applyManualDiscount(id, type, value));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid discount type or value"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
