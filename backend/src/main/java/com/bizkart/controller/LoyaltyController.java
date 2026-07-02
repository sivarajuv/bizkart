package com.bizkart.controller;

import com.bizkart.security.JwtUtils;
import com.bizkart.service.LoyaltyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/portal/loyalty")
public class LoyaltyController {

    private final LoyaltyService loyaltyService;
    private final JwtUtils jwtUtils;

    public LoyaltyController(LoyaltyService loyaltyService, JwtUtils jwtUtils) {
        this.loyaltyService = loyaltyService;
        this.jwtUtils       = jwtUtils;
    }

    /** Get customer's loyalty points balance */
    @GetMapping
    public ResponseEntity<?> getBalance(@RequestHeader("Authorization") String authHeader) {
        try {
            Long customerId = jwtUtils.getCustomerIdFromToken(authHeader.replace("Bearer ", ""));
            int balance     = loyaltyService.getBalance(customerId);
            double rupeeVal = balance * 0.50;
            return ResponseEntity.ok(Map.of(
                "points", balance,
                "rupeeValue", rupeeVal,
                "message", balance + " pts = ₹" + String.format("%.2f", rupeeVal)
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }
}
