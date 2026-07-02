package com.bizkart.controller;

import com.bizkart.model.OnlineOrder;
import com.bizkart.model.Shop;
import com.bizkart.repository.OnlineOrderRepository;
import com.bizkart.repository.ProductRepository;
import com.bizkart.repository.ShopRepository;
import com.bizkart.security.JwtUtils;
import com.bizkart.service.OnlineOrderService;
import com.bizkart.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/portal")
public class CustomerPortalController {

    private final ShopRepository shopRepo;
    private final ProductService productService;
    private final ProductRepository productRepo;
    private final OnlineOrderService orderService;
    private final OnlineOrderRepository orderRepo;
    private final JwtUtils jwtUtils;

    public CustomerPortalController(
        ShopRepository shopRepo,
        ProductService productService,
        ProductRepository productRepo,
        OnlineOrderService orderService,
        OnlineOrderRepository orderRepo,
        JwtUtils jwtUtils
    ) {
        this.shopRepo       = shopRepo;
        this.productService = productService;
        this.productRepo    = productRepo;
        this.orderService   = orderService;
        this.orderRepo      = orderRepo;
        this.jwtUtils       = jwtUtils;
    }

    /** Public – list of enabled shops */
    @GetMapping("/shops")
    public List<Shop> listShops() {
        return shopRepo.findAll().stream()
            .filter(Shop::isEnabled)
            .toList();
    }

    /**
     * Public – smart search across all enabled shops and their active products.
     * Returns { shops: [...], products: [...] } matched by name/category/brand.
     */
    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String q) {
        if (q == null || q.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Query required"));

        String lower = q.toLowerCase().trim();

        Set<Long> enabledShopIds = shopRepo.findAll().stream()
            .filter(Shop::isEnabled)
            .map(Shop::getId)
            .collect(Collectors.toSet());

        List<Shop> matchedShops = shopRepo.findAll().stream()
            .filter(Shop::isEnabled)
            .filter(s -> s.getName().toLowerCase().contains(lower)
                      || (s.getBusinessType() != null && s.getBusinessType().toLowerCase().contains(lower))
                      || (s.getAddress() != null && s.getAddress().toLowerCase().contains(lower)))
            .toList();

        List<Map<String, Object>> matchedProducts = new ArrayList<>();
        productRepo.findAll().stream()
            .filter(p -> p.isActive() && enabledShopIds.contains(p.getShop().getId()))
            .filter(p -> p.getName().toLowerCase().contains(lower)
                      || (p.getCategory() != null && p.getCategory().toLowerCase().contains(lower))
                      || (p.getBrand()    != null && p.getBrand().toLowerCase().contains(lower))
                      || (p.getDescription() != null && p.getDescription().toLowerCase().contains(lower)))
            .forEach(p -> {
                Map<String, Object> row = new HashMap<>();
                row.put("productId",   p.getId());
                row.put("productName", p.getName());
                row.put("category",    p.getCategory());
                row.put("price",       p.getPrice());
                row.put("stock",       p.getStock());
                row.put("shopId",      p.getShop().getId());
                row.put("shopName",    p.getShop().getName());
                matchedProducts.add(row);
            });

        return ResponseEntity.ok(Map.of("shops", matchedShops, "products", matchedProducts));
    }

    /** Public – products for a specific shop */
    @GetMapping("/products")
    public ResponseEntity<?> listProducts(@RequestParam Long shopId) {
        try {
            return ResponseEntity.ok(productService.getProductsByShop(shopId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Authenticated – place an order */
    @PostMapping("/orders")
    public ResponseEntity<?> placeOrder(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody OnlineOrderService.PlaceOrderRequest req
    ) {
        try {
            Long customerId = extractCustomerId(authHeader);
            OnlineOrder order = orderService.placeOrder(customerId, req);
            return ResponseEntity.ok(order);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Authenticated – list customer's orders */
    @GetMapping("/orders")
    public ResponseEntity<?> getOrders(@RequestHeader("Authorization") String authHeader) {
        try {
            Long customerId = extractCustomerId(authHeader);
            List<OnlineOrder> orders = orderRepo.findByCustomerAccountIdOrderByCreatedAtDesc(customerId);
            return ResponseEntity.ok(orders);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Authenticated – get a single order */
    @GetMapping("/orders/{id}")
    public ResponseEntity<?> getOrder(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        try {
            Long customerId = extractCustomerId(authHeader);
            OnlineOrder order = orderRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
            if (!order.getCustomerAccount().getId().equals(customerId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
            }
            return ResponseEntity.ok(order);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Authenticated – reorder: clone an existing order into a cart payload */
    @GetMapping("/orders/{id}/reorder")
    public ResponseEntity<?> reorder(
        @RequestHeader("Authorization") String authHeader,
        @PathVariable Long id
    ) {
        try {
            Long customerId = extractCustomerId(authHeader);
            OnlineOrder original = orderRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
            if (!original.getCustomerAccount().getId().equals(customerId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
            }

            // Build cart items list from the original order
            List<Map<String, Object>> items = original.getItems().stream()
                .map(item -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("productId",   item.getProduct().getId());
                    m.put("productName", item.getProductName());
                    m.put("quantity",    item.getQuantity());
                    m.put("unitPrice",   item.getUnitPrice());
                    return m;
                })
                .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of(
                "shopId", original.getShop().getId(),
                "items",  items
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Shop staff – update delivery agent GPS coordinates */
    @PatchMapping("/orders/{id}/agent-location")
    public ResponseEntity<?> updateAgentLocation(
        @PathVariable Long id,
        @RequestBody Map<String, Double> body
    ) {
        try {
            OnlineOrder order = orderRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
            order.setAgentLatitude(body.get("latitude"));
            order.setAgentLongitude(body.get("longitude"));
            order.setAgentUpdatedAt(LocalDateTime.now());
            orderRepo.save(order);
            return ResponseEntity.ok(Map.of("updated", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Long extractCustomerId(String authHeader) {
        String token = authHeader.startsWith("Bearer ")
            ? authHeader.substring(7)
            : authHeader;
        return jwtUtils.getCustomerIdFromToken(token);
    }
}
