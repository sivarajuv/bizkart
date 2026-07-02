package com.bizkart.controller;

import com.bizkart.model.Shop;
import com.bizkart.service.ProductService;
import com.bizkart.service.ShopService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/shops")
public class ShopController {

    private final ShopService shopService;
    private final ProductService productService;

    public ShopController(ShopService shopService, ProductService productService) {
        this.shopService = shopService;
        this.productService = productService;
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
