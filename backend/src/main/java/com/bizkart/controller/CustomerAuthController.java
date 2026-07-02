package com.bizkart.controller;

import com.bizkart.model.CustomerAccount;
import com.bizkart.security.JwtUtils;
import com.bizkart.service.CustomerAccountService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/customer-auth")
public class CustomerAuthController {

    private final CustomerAccountService service;
    private final JwtUtils jwtUtils;

    public CustomerAuthController(CustomerAccountService service, JwtUtils jwtUtils) {
        this.service  = service;
        this.jwtUtils = jwtUtils;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(
        @RequestBody CustomerAccountService.RegisterRequest req
    ) {
        try {
            return ResponseEntity.ok(service.register(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
        @RequestBody CustomerAccountService.LoginRequest req
    ) {
        try {
            return ResponseEntity.ok(service.login(req));
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(
        @RequestBody CustomerAccountService.ResetPasswordRequest req
    ) {
        try {
            return ResponseEntity.ok(service.resetPassword(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(
        @RequestHeader("Authorization") String authHeader
    ) {
        try {
            String token = authHeader.replace("Bearer ", "");
            Long id = jwtUtils.getCustomerIdFromToken(token);
            CustomerAccount account = service.getById(id);
            return ResponseEntity.ok(account);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or expired token"));
        }
    }
}
