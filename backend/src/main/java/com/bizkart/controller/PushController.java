package com.bizkart.controller;

import com.bizkart.security.JwtUtils;
import com.bizkart.service.PushNotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/portal/push")
public class PushController {

    private final PushNotificationService pushService;
    private final JwtUtils jwtUtils;

    public PushController(PushNotificationService pushService, JwtUtils jwtUtils) {
        this.pushService = pushService;
        this.jwtUtils    = jwtUtils;
    }

    /** Register a browser push subscription */
    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody PushNotificationService.SubscribeRequest req
    ) {
        try {
            Long customerId = jwtUtils.getCustomerIdFromToken(authHeader.replace("Bearer ", ""));
            return ResponseEntity.ok(pushService.subscribe(customerId, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Unsubscribe */
    @DeleteMapping("/unsubscribe")
    public ResponseEntity<?> unsubscribe(@RequestBody Map<String, String> body) {
        try {
            pushService.unsubscribe(body.get("endpoint"));
            return ResponseEntity.ok(Map.of("message", "Unsubscribed"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
