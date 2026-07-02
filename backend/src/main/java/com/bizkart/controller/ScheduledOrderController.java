package com.bizkart.controller;

import com.bizkart.security.JwtUtils;
import com.bizkart.service.ScheduledOrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/portal/scheduled-orders")
public class ScheduledOrderController {

    private final ScheduledOrderService service;
    private final JwtUtils jwtUtils;

    public ScheduledOrderController(ScheduledOrderService service, JwtUtils jwtUtils) {
        this.service  = service;
        this.jwtUtils = jwtUtils;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestHeader("Authorization") String auth) {
        try {
            return ResponseEntity.ok(service.listByCustomer(customerId(auth)));
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> create(
        @RequestHeader("Authorization") String auth,
        @RequestBody ScheduledOrderService.CreateScheduledOrderRequest req
    ) {
        try {
            return ResponseEntity.ok(service.create(customerId(auth), req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancel(
        @RequestHeader("Authorization") String auth,
        @PathVariable Long id
    ) {
        try {
            return ResponseEntity.ok(service.cancel(id, customerId(auth)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private Long customerId(String auth) {
        return jwtUtils.getCustomerIdFromToken(auth.replace("Bearer ", ""));
    }
}
