package com.bizkart.service;

import com.bizkart.model.OnlineOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * WhatsApp Notification Service
 *
 * Supports two modes:
 *  1. WATI / 360dialog / other BSP — set whatsapp.api.url + whatsapp.api.token
 *  2. wa.me link generation (fallback) — staff opens link manually or via automation
 *
 * For quick setup without a paid BSP, the frontend opens wa.me links automatically.
 * This service handles server-side notification for automated pipelines.
 *
 * Configure in application.properties:
 *   whatsapp.shop.phone=917259000552
 *   whatsapp.api.url=https://api.wati.io/api/v1/sendSessionMessage
 *   whatsapp.api.token=YOUR_TOKEN
 *   whatsapp.enabled=true
 */
@Service
public class WhatsAppNotificationService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppNotificationService.class);

    @Value("${whatsapp.shop.phone:}")
    private String shopPhone;

    @Value("${whatsapp.api.url:}")
    private String apiUrl;

    @Value("${whatsapp.api.token:}")
    private String apiToken;

    @Value("${whatsapp.enabled:false}")
    private boolean enabled;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Build the notification message for a new order.
     */
    public String buildOrderMessage(OnlineOrder order) {
        StringBuilder sb = new StringBuilder();
        sb.append("🛒 *New Order Received!*\n\n");
        sb.append("Order: ").append(order.getOrderNumber()).append("\n");

        if (order.getCustomerAccount() != null) {
            sb.append("Customer: ").append(order.getCustomerAccount().getName())
              .append(" (").append(order.getCustomerAccount().getPhone()).append(")\n");
        }

        sb.append("Type: ").append(order.getOrderType() == OnlineOrder.OrderType.DELIVERY
            ? "🛵 Home Delivery" : "🏪 Pickup").append("\n\n");

        sb.append("*Items:*\n");
        if (order.getItems() != null) {
            for (var item : order.getItems()) {
                sb.append("• ").append(item.getProductName())
                  .append(" x").append(item.getQuantity())
                  .append(" — ₹").append(item.getSubtotal()).append("\n");
            }
        }

        sb.append("\n*Total: ₹").append(order.getTotalAmount()).append("*\n");
        sb.append("Payment: ").append(order.getPaymentMethod()).append("\n");

        if (order.getDeliveryAddressText() != null && !order.getDeliveryAddressText().isBlank()) {
            sb.append("Address: ").append(order.getDeliveryAddressText()).append("\n");
        }

        if (order.getCustomerNotes() != null && !order.getCustomerNotes().isBlank()) {
            sb.append("Note: ").append(order.getCustomerNotes()).append("\n");
        }

        sb.append("\nPlease accept the order in BizKart dashboard.");
        return sb.toString();
    }

    /**
     * Build a wa.me URL for manual sending (used by frontend fallback).
     */
    public String buildWaLink(String phone, OnlineOrder order) {
        String clean = phone.replaceAll("\\D", "");
        String num = clean.startsWith("91") ? clean : "91" + clean;
        try {
            String msg = java.net.URLEncoder.encode(buildOrderMessage(order), "UTF-8");
            return "https://wa.me/" + num + "?text=" + msg;
        } catch (Exception e) {
            return "https://wa.me/" + num;
        }
    }

    /**
     * Send notification via configured BSP API (if enabled + configured).
     * Falls back to logging the wa.me link.
     */
    public void notifyNewOrder(OnlineOrder order) {
        if (!enabled || shopPhone == null || shopPhone.isBlank()) {
            log.info("WhatsApp notifications disabled or phone not configured. Order: {}", order.getOrderNumber());
            return;
        }

        String message = buildOrderMessage(order);

        if (apiUrl != null && !apiUrl.isBlank() && apiToken != null && !apiToken.isBlank()) {
            sendViaBSP(message);
        } else {
            // Log the wa.me link so it can be picked up by automation or displayed in logs
            log.info("WhatsApp wa.me link for order {}: {}", order.getOrderNumber(), buildWaLink(shopPhone, order));
        }
    }

    private void sendViaBSP(String message) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + apiToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, String> body = new HashMap<>();
            body.put("whatsappNumber", shopPhone);
            body.put("messageText", message);

            HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(apiUrl, request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("WhatsApp notification sent successfully to {}", shopPhone);
            } else {
                log.warn("WhatsApp API returned: {} — {}", response.getStatusCode(), response.getBody());
            }
        } catch (Exception e) {
            log.error("Failed to send WhatsApp notification: {}", e.getMessage());
        }
    }
}
