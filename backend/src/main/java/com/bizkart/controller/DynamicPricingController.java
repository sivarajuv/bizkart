package com.bizkart.controller;

import com.bizkart.model.Product;
import com.bizkart.repository.ProductRepository;
import com.bizkart.service.ClaudeAIService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/pricing")
public class DynamicPricingController {

    private final ProductRepository productRepo;
    private final ClaudeAIService aiService;

    public DynamicPricingController(ProductRepository productRepo, ClaudeAIService aiService) {
        this.productRepo = productRepo;
        this.aiService   = aiService;
    }

    /** Returns AI-powered pricing suggestions for all active products of a shop */
    @GetMapping("/suggestions")
    public ResponseEntity<?> getSuggestions(
        @RequestParam(required = false) Long shopId
    ) {
        List<Product> products = shopId != null
            ? productRepo.findAll().stream()
                .filter(p -> p.isActive() && p.getShop().getId().equals(shopId))
                .collect(Collectors.toList())
            : productRepo.findAll().stream()
                .filter(Product::isActive)
                .limit(20)
                .collect(Collectors.toList());

        List<Map<String, Object>> results = new ArrayList<>();
        for (Product p : products) {
            String suggestion = aiService.getPricingSuggestion(
                p.getName(),
                p.getCategory() != null ? p.getCategory() : "General",
                p.getPrice().doubleValue(),
                p.getStock()
            );
            Map<String, Object> row = new HashMap<>();
            row.put("productId",    p.getId());
            row.put("productName",  p.getName());
            row.put("category",     p.getCategory());
            row.put("currentPrice", p.getPrice());
            row.put("stock",        p.getStock());
            row.put("shopId",       p.getShop().getId());
            row.put("shopName",     p.getShop().getName());
            row.put("suggestion",   suggestion);
            results.add(row);
        }
        return ResponseEntity.ok(results);
    }
}
