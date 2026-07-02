package com.bizkart.controller;

import com.bizkart.model.Product;
import com.bizkart.service.ClaudeAIService;
import com.bizkart.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;
    private final ClaudeAIService claudeAIService;

    public ProductController(ProductService productService, ClaudeAIService claudeAIService) {
        this.productService = productService;
        this.claudeAIService = claudeAIService;
    }

    @GetMapping
    public List<Product> getAllProducts(Authentication authentication) {
        return productService.getAllProducts(authentication);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> getProduct(Authentication authentication, @PathVariable Long id) {
        return productService.getProductById(authentication, id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/category/{category}")
    public List<Product> getByCategory(Authentication authentication, @PathVariable String category) {
        return productService.getProductsByCategory(authentication, category);
    }

    @GetMapping("/search")
    public List<Product> search(Authentication authentication, @RequestParam String q) {
        return productService.searchProducts(authentication, q);
    }

    @GetMapping("/categories")
    public List<String> getCategories(Authentication authentication) {
        return productService.getAllCategories(authentication);
    }

    @PostMapping
    public ResponseEntity<?> createProduct(Authentication authentication, @RequestBody ProductService.ProductRequest product) {
        try {
            return ResponseEntity.ok(productService.createProduct(authentication, product));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProduct(Authentication authentication, @PathVariable Long id, @RequestBody ProductService.ProductRequest product) {
        try {
            return ResponseEntity.ok(productService.updateProduct(authentication, id, product));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/price")
    public ResponseEntity<?> updatePrice(Authentication authentication, @PathVariable Long id, @RequestBody Map<String, Double> body) {
        try {
            BigDecimal price = BigDecimal.valueOf(body.get("price"));
            return ResponseEntity.ok(productService.updatePrice(authentication, id, price));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/stock")
    public ResponseEntity<?> updateStock(Authentication authentication, @PathVariable Long id, @RequestBody Map<String, Integer> body) {
        try {
            return ResponseEntity.ok(productService.updateStock(authentication, id, body.get("stock")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProduct(Authentication authentication, @PathVariable Long id) {
        try {
            productService.deleteProduct(authentication, id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/ai-price-suggestion")
    public ResponseEntity<Map<String, String>> getAIPriceSuggestion(Authentication authentication, @PathVariable Long id) {
        return productService.getProductById(authentication, id).map(product -> {
            String suggestion = claudeAIService.getPricingSuggestion(
                product.getName(), product.getCategory(),
                product.getPrice().doubleValue(), product.getStock()
            );
            return ResponseEntity.ok(Map.of("suggestion", suggestion));
        }).orElse(ResponseEntity.notFound().build());
    }
}
