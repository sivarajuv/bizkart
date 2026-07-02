package com.bizkart.controller;

import com.bizkart.model.Shop;
import com.bizkart.model.User;
import com.bizkart.service.CurrentUserService;
import com.bizkart.service.ProductService;
import com.bizkart.service.ShopService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/shops")
public class ShopController {

    private final ShopService shopService;
    private final ProductService productService;
    private final CurrentUserService currentUserService;

    public ShopController(ShopService shopService, ProductService productService, CurrentUserService currentUserService) {
        this.shopService = shopService;
        this.productService = productService;
        this.currentUserService = currentUserService;
    }

    /**
     * Lets a shop's own staff (not just SUPER_ADMIN) set their shop's
     * WhatsApp/notification phone number. Everything else under /api/shops/**
     * is SUPER_ADMIN-only (see SecurityConfig), which previously meant the
     * people who actually need to configure this — shop ADMIN/MANAGER — had
     * no way to persist it server-side, so the frontend fell back to
     * per-browser localStorage (which doesn't carry over between devices,
     * e.g. desktop web vs the Android app).
     */
    @PatchMapping("/my/whatsapp-phone")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public ResponseEntity<?> updateMyWhatsappPhone(
        Authentication authentication,
        @RequestBody Map<String, String> body
    ) {
        try {
            User user = currentUserService.requireUser(authentication);
            Shop shop = currentUserService.requireShop(user);
            String phone = body.getOrDefault("phone", "");
            Shop updated = shopService.updateShop(shop.getId(), Map.of("phone", phone));
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<Shop> getAllShops() {
        return shopService.getAllShops();
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createShop(@RequestBody ShopService.ShopRequest request) {
        try {
            Shop shop = shopService.createShop(request);
            productService.initializeDefaultCatalogForShop(shop);
            return ResponseEntity.ok(shop);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updateShop(@PathVariable Long id, @RequestBody Map<String, String> updates) {
        try {
            Shop shop = shopService.updateShop(id, updates);
            productService.initializeDefaultCatalogForShop(shop);
            return ResponseEntity.ok(shop);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/toggle-status")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Shop> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(shopService.toggleStatus(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deleteShop(@PathVariable Long id) {
        try {
            shopService.deleteShop(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
