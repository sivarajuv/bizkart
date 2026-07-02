package com.bizkart.controller;

import com.bizkart.model.Order;
import com.bizkart.service.ClaudeAIService;
import com.bizkart.service.OrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;
    private final ClaudeAIService claudeAIService;

    public OrderController(OrderService orderService, ClaudeAIService claudeAIService) {
        this.orderService = orderService;
        this.claudeAIService = claudeAIService;
    }

    @PostMapping
    public ResponseEntity<?> createOrder(Authentication authentication, @RequestBody OrderService.CreateOrderRequest request) {
        try {
            Order order = orderService.createOrder(authentication, request);
            return ResponseEntity.ok(order);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping
    public List<Order> getAllOrders(Authentication authentication) {
        return orderService.getAllOrders(authentication);
    }

    @GetMapping("/today")
    public List<Order> getTodaysOrders(Authentication authentication) {
        return orderService.getTodaysOrders(authentication);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Order> getOrder(Authentication authentication, @PathVariable Long id) {
        return orderService.getOrderById(authentication, id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/dashboard/stats")
    public ResponseEntity<?> getDashboardStats(Authentication authentication) {
        try {
            return ResponseEntity.ok(orderService.getDashboardStats(authentication));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/reports/top-products")
    public ResponseEntity<?> getTopProducts(Authentication authentication) {
        try {
            return ResponseEntity.ok(orderService.getTopSellingProducts(authentication));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/reports/by-category")
    public ResponseEntity<?> getSalesByCategory(Authentication authentication) {
        try {
            return ResponseEntity.ok(orderService.getSalesByCategory(authentication));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/reports/daily-revenue")
    public ResponseEntity<?> getDailyRevenue(Authentication authentication) {
        try {
            return ResponseEntity.ok(orderService.getDailyRevenue(authentication));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/reports/profit-loss")
    public ResponseEntity<?> getProfitLoss(Authentication authentication) {
        try {
            return ResponseEntity.ok(orderService.getProfitAndLoss(authentication));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/reports/ai-insights")
    public ResponseEntity<Map<String, String>> getAIInsights(Authentication authentication) {
        try {
            List<Map<String, Object>> salesData = orderService.getTopSellingProducts(authentication);
            String insights = claudeAIService.getInventoryInsight(salesData);
            return ResponseEntity.ok(Map.of("insights", insights));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
