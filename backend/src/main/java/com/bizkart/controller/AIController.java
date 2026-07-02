package com.bizkart.controller;

import com.bizkart.service.ClaudeAIService;
import com.bizkart.service.CurrentUserService;
import com.bizkart.service.OrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    private final ClaudeAIService claudeAIService;
    private final OrderService orderService;
    private final CurrentUserService currentUserService;

    public AIController(ClaudeAIService claudeAIService, OrderService orderService, CurrentUserService currentUserService) {
        this.claudeAIService = claudeAIService;
        this.orderService = orderService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/chat")
    public ResponseEntity<Map<String, String>> chat(Authentication authentication, @RequestBody Map<String, String> request) {
        String userMessage = request.get("message");
        if (userMessage == null || userMessage.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Message is required"));
        }

        String shopContext;
        if (currentUserService.canViewBusinessInsights(currentUserService.requireUser(authentication))) {
            Map<String, Object> stats = orderService.getDashboardStats(authentication);
            shopContext = String.format(
                "Business: %s, Total orders: %s, Today's orders: %s, Total revenue: Rs.%s, Today's revenue: Rs.%s",
                stats.get("activeShopName"),
                stats.get("totalOrders"),
                stats.get("todayOrders"),
                stats.get("totalRevenue"),
                stats.get("todayRevenue")
            );
        } else {
            shopContext = "Platform admin context: assist with onboarding, business setup, catalog guidance, and operations without using private revenue or dashboard data.";
        }

        String response = claudeAIService.getChatResponse(userMessage, shopContext);
        return ResponseEntity.ok(Map.of("response", response));
    }
}
