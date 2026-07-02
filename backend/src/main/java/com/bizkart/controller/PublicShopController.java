package com.bizkart.controller;

import com.bizkart.model.Product;
import com.bizkart.model.Shop;
import com.bizkart.repository.ProductRepository;
import com.bizkart.repository.ShopRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public/shops")
public class PublicShopController {

    private final ShopRepository shopRepo;
    private final ProductRepository productRepo;

    public PublicShopController(ShopRepository shopRepo, ProductRepository productRepo) {
        this.shopRepo    = shopRepo;
        this.productRepo = productRepo;
    }

    /** Public shareable shop catalog – by public slug */
    @GetMapping("/{slug}")
    public ResponseEntity<?> getPublicShop(@PathVariable String slug) {
        Optional<Shop> shopOpt = shopRepo.findAll().stream()
            .filter(s -> slug.equalsIgnoreCase(s.getPublicSlug()) || slug.equalsIgnoreCase(s.getCode()))
            .findFirst();

        if (shopOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Shop not found"));
        }

        Shop shop = shopOpt.get();
        if (!shop.isEnabled()) {
            return ResponseEntity.status(410).body(Map.of("error", "Shop is currently unavailable"));
        }

        List<Product> products = productRepo.findAll().stream()
            .filter(p -> p.isActive() && p.getShop().getId().equals(shop.getId()))
            .collect(Collectors.toList());

        // Group by category
        Map<String, List<Map<String, Object>>> byCategory = new LinkedHashMap<>();
        for (Product p : products) {
            String cat = p.getCategory() != null ? p.getCategory() : "Others";
            byCategory.computeIfAbsent(cat, k -> new ArrayList<>()).add(productToMap(p));
        }

        Map<String, Object> shopInfo = new LinkedHashMap<>();
        shopInfo.put("id",           shop.getId());
        shopInfo.put("name",         shop.getName());
        shopInfo.put("businessType", shop.getBusinessType());
        shopInfo.put("address",      shop.getAddress());
        shopInfo.put("phone",        shop.getPhone());
        shopInfo.put("slug",         shop.getPublicSlug() != null ? shop.getPublicSlug() : shop.getCode());

        return ResponseEntity.ok(Map.of(
            "shop",        shopInfo,
            "byCategory",  byCategory,
            "totalProducts", products.size()
        ));
    }

    /** Admin: set public slug for a shop */
    @PatchMapping("/{shopId}/slug")
    public ResponseEntity<?> setSlug(@PathVariable Long shopId, @RequestBody Map<String, String> body) {
        Shop shop = shopRepo.findById(shopId)
            .orElseThrow(() -> new RuntimeException("Shop not found"));
        String slug = body.get("slug");
        if (slug == null || slug.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Slug is required"));
        }
        slug = slug.toLowerCase().replaceAll("[^a-z0-9-]", "-");
        // Check uniqueness
        String finalSlug = slug;
        boolean taken = shopRepo.findAll().stream()
            .anyMatch(s -> !s.getId().equals(shopId) && finalSlug.equals(s.getPublicSlug()));
        if (taken) {
            return ResponseEntity.badRequest().body(Map.of("error", "Slug already taken"));
        }
        shop.setPublicSlug(slug);
        shopRepo.save(shop);
        return ResponseEntity.ok(Map.of("slug", slug, "shareUrl", "https://bizkart.app/s/" + slug));
    }

    private Map<String, Object> productToMap(Product p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",       p.getId());
        m.put("name",     p.getName());
        m.put("price",    p.getPrice());
        m.put("unit",     p.getUnit());
        m.put("stock",    p.getStock());
        m.put("category", p.getCategory());
        m.put("brand",    p.getBrand());
        return m;
    }
}
