package com.bizkart.controller;

import com.bizkart.model.OnlineOrder;
import com.bizkart.service.OnlineOrderService;
import com.bizkart.service.WhatsAppNotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/**
 * WhatsApp Notification Controller
 *
 * GET  /api/whatsapp/order/{id}/link  → returns wa.me link for manual send
 * POST /api/whatsapp/order/{id}/send  → triggers server-side BSP send (if configured)
 */
@RestController
@RequestMapping("/api/whatsapp")
public class WhatsAppController {

    private final OnlineOrderService orderService;
    private final WhatsAppNotificationService whatsAppService;

    public WhatsAppController(
        OnlineOrderService orderService,
        WhatsAppNotificationService whatsAppService
    ) {
        this.orderService   = orderService;
        this.whatsAppService = whatsAppService;
    }

    /**
     * Returns a wa.me link for the given order. `phone` is optional — when
     * omitted, defaults to the order's own shop's phone number (falling back
     * to whatsapp.shop.phone), so the admin UI doesn't need to already know
     * which number to send to.
     */
    @GetMapping("/order/{id}/link")
    public ResponseEntity<?> getWaLink(
        @PathVariable Long id,
        @RequestParam(required = false) String phone
    ) {
        try {
            OnlineOrder order = orderService.getOrder(id);
            String targetPhone = (phone != null && !phone.isBlank()) ? phone : whatsAppService.resolvePhone(order);
            if (targetPhone == null || targetPhone.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "No WhatsApp number configured for this shop. Set a phone number on the shop, or whatsapp.shop.phone as a fallback."
                ));
            }
            String link = whatsAppService.buildWaLink(targetPhone, order);
            String message = whatsAppService.buildOrderMessage(order);
            return ResponseEntity.ok(Map.of(
                "link", link,
                "message", message,
                "phone", targetPhone
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Triggers server-side notification (requires BSP configured) */
    @PostMapping("/order/{id}/send")
    public ResponseEntity<?> sendNotification(@PathVariable Long id) {
        try {
            OnlineOrder order = orderService.getOrder(id);
            whatsAppService.notifyNewOrder(order);
            return ResponseEntity.ok(Map.of("status", "notification triggered", "order", order.getOrderNumber()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
