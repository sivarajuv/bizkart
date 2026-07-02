package com.bizkart.controller;

import com.bizkart.model.OnlineOrder;
import com.bizkart.model.OnlineOrderItem;
import com.bizkart.model.Product;
import com.bizkart.repository.OnlineOrderRepository;
import com.bizkart.repository.ProductRepository;
import com.bizkart.security.JwtUtils;
import com.bizkart.service.ClaudeAIService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/portal/recommendations")
public class AIRecommendationsController {

    private final OnlineOrderRepository orderRepo;
    private final ProductRepository productRepo;
    private final ClaudeAIService aiService;
    private final JwtUtils jwtUtils;

    public AIRecommendationsController(
        OnlineOrderRepository orderRepo,
        ProductRepository productRepo,
        ClaudeAIService aiService,
        JwtUtils jwtUtils
    ) {
        this.orderRepo   = orderRepo;
        this.productRepo = productRepo;
        this.aiService   = aiService;
        this.jwtUtils    = jwtUtils;
    }

    @GetMapping
    public ResponseEntity<?> getRecommendations(
        @RequestHeader("Authorization") String auth,
        @RequestParam Long shopId
    ) {
        try {
            Long customerId = jwtUtils.getCustomerIdFromToken(auth.replace("Bearer ", ""));

            // Get customer's past order items for this shop
            List<OnlineOrder> pastOrders = orderRepo.findAll().stream()
                .filter(o -> o.getCustomerAccount().getId().equals(customerId)
                          && o.getShop().getId().equals(shopId)
                          && o.getStatus() != OnlineOrder.OrderStatus.CANCELLED)
                .sorted(Comparator.comparing(OnlineOrder::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .collect(Collectors.toList());

            // All active products in shop
            List<Product> shopProducts = productRepo.findAll().stream()
                .filter(p -> p.isActive() && p.getShop().getId().equals(shopId))
                .collect(Collectors.toList());

            if (shopProducts.isEmpty()) {
                return ResponseEntity.ok(List.of());
            }

            if (pastOrders.isEmpty()) {
                // No history: return top 6 products by price (bestsellers proxy)
                List<Map<String, Object>> defaults = shopProducts.stream()
                    .limit(6)
                    .map(p -> productToMap(p, "Popular in this shop"))
                    .collect(Collectors.toList());
                return ResponseEntity.ok(defaults);
            }

            // Build order history summary for Claude
            Set<Long> orderedProductIds = new HashSet<>();
            StringBuilder historyDesc = new StringBuilder();
            for (OnlineOrder order : pastOrders) {
                for (OnlineOrderItem item : order.getItems()) {
                    orderedProductIds.add(item.getProduct().getId());
                    historyDesc.append("- ").append(item.getProductName())
                        .append(" (qty: ").append(item.getQuantity()).append(")\n");
                }
            }

            String productCatalog = shopProducts.stream()
                .filter(p -> !orderedProductIds.contains(p.getId()))
                .map(p -> p.getId() + ":" + p.getName() + "(" + (p.getCategory() != null ? p.getCategory() : "") + ")")
                .collect(Collectors.joining(", "));

            if (productCatalog.isBlank()) {
                // All products already ordered – suggest reorders
                List<Map<String, Object>> reorderSuggestions = shopProducts.stream()
                    .filter(p -> orderedProductIds.contains(p.getId()))
                    .limit(6)
                    .map(p -> productToMap(p, "You've ordered this before"))
                    .collect(Collectors.toList());
                return ResponseEntity.ok(reorderSuggestions);
            }

            String aiPrompt = "Customer past orders:\n" + historyDesc + "\nAvailable products (id:name(category)): " + productCatalog +
                "\nReturn exactly 6 product IDs from available products that this customer would likely enjoy, as a comma-separated list. Only IDs, no explanation.";
            String systemCtx = "You are a smart recommendation engine for a grocery/kirana shop. Suggest products based on purchase history.";

            String aiResponse = aiService.askClaude(aiPrompt, systemCtx);

            // Parse AI response: extract numeric IDs
            Set<Long> recommendedIds = Arrays.stream(aiResponse.split("[,\\s]+"))
                .map(s -> s.replaceAll("[^0-9]", ""))
                .filter(s -> !s.isEmpty())
                .map(Long::parseLong)
                .collect(Collectors.toSet());

            List<Map<String, Object>> recommendations = shopProducts.stream()
                .filter(p -> recommendedIds.contains(p.getId()))
                .map(p -> productToMap(p, "Recommended for you"))
                .collect(Collectors.toList());

            // Pad with non-ordered products if AI returned too few
            if (recommendations.size() < 4) {
                shopProducts.stream()
                    .filter(p -> !orderedProductIds.contains(p.getId()) && !recommendedIds.contains(p.getId()))
                    .limit(6 - recommendations.size())
                    .forEach(p -> recommendations.add(productToMap(p, "You might like this")));
            }

            return ResponseEntity.ok(recommendations);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private Map<String, Object> productToMap(Product p, String reason) {
        Map<String, Object> m = new HashMap<>();
        m.put("productId",   p.getId());
        m.put("productName", p.getName());
        m.put("category",    p.getCategory());
        m.put("price",       p.getPrice());
        m.put("stock",       p.getStock());
        m.put("unit",        p.getUnit());
        m.put("reason",      reason);
        return m;
    }
}
