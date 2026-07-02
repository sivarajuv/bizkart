package com.bizkart.controller;

import com.bizkart.model.OnlineOrder;
import com.bizkart.model.OrderMessage;
import com.bizkart.repository.OnlineOrderRepository;
import com.bizkart.repository.OrderMessageRepository;
import com.bizkart.security.JwtUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class OrderMessageController {

    private final OrderMessageRepository msgRepo;
    private final OnlineOrderRepository orderRepo;
    private final JwtUtils jwtUtils;

    public OrderMessageController(
        OrderMessageRepository msgRepo,
        OnlineOrderRepository orderRepo,
        JwtUtils jwtUtils
    ) {
        this.msgRepo   = msgRepo;
        this.orderRepo = orderRepo;
        this.jwtUtils  = jwtUtils;
    }

    /** Customer sends a message on an order */
    @GetMapping("/api/portal/orders/{orderId}/messages")
    public ResponseEntity<?> listMessages(
        @RequestHeader("Authorization") String auth,
        @PathVariable Long orderId
    ) {
        try {
            Long customerId = customerId(auth);
            OnlineOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
            if (!order.getCustomerAccount().getId().equals(customerId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
            }
            return ResponseEntity.ok(msgRepo.findByOnlineOrderIdOrderByCreatedAtAsc(orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/api/portal/orders/{orderId}/messages")
    public ResponseEntity<?> sendMessage(
        @RequestHeader("Authorization") String auth,
        @PathVariable Long orderId,
        @RequestBody Map<String, String> body
    ) {
        try {
            Long customerId = customerId(auth);
            OnlineOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
            if (!order.getCustomerAccount().getId().equals(customerId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
            }
            String text = body.get("message");
            if (text == null || text.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Message cannot be empty"));
            }
            OrderMessage msg = new OrderMessage();
            msg.setOnlineOrder(order);
            msg.setSenderType(OrderMessage.SenderType.CUSTOMER);
            msg.setSenderId(customerId);
            msg.setMessage(text.trim());
            return ResponseEntity.ok(msgRepo.save(msg));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Shop staff replies */
    @PostMapping("/api/shop-orders/{orderId}/messages")
    public ResponseEntity<?> shopReply(
        @PathVariable Long orderId,
        @RequestBody Map<String, String> body
    ) {
        try {
            OnlineOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
            String text = body.get("message");
            if (text == null || text.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Message cannot be empty"));
            }
            OrderMessage msg = new OrderMessage();
            msg.setOnlineOrder(order);
            msg.setSenderType(OrderMessage.SenderType.SHOP);
            msg.setSenderId(order.getShop().getId());
            msg.setMessage(text.trim());
            return ResponseEntity.ok(msgRepo.save(msg));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/api/shop-orders/{orderId}/messages")
    public ResponseEntity<?> shopListMessages(@PathVariable Long orderId) {
        try {
            return ResponseEntity.ok(msgRepo.findByOnlineOrderIdOrderByCreatedAtAsc(orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private Long customerId(String auth) {
        return jwtUtils.getCustomerIdFromToken(auth.replace("Bearer ", ""));
    }
}
