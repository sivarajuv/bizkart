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
 * The recipient number is the SHOP's own phone number (Shop.phone) — this is
 * a multi-tenant platform, so each shop notifies its own number, not a single
 * global one. whatsapp.shop.phone in application.properties is only a
 * fallback for a shop that hasn't set its own phone yet.
 *
 * Supports two delivery modes:
 *  1. WATI / 360dialog / other BSP — set whatsapp.api.url + whatsapp.api.token.
 *     Actually sends the message via HTTP API.
 *  2. wa.me click-to-chat link (no BSP configured) — this service only LOGS
 *     the link server-side in that case; nothing is delivered automatically.
 *     The admin Online Orders page has a "Notify via WhatsApp" button that
 *     fetches this same link (GET /api/whatsapp/order/{id}/link) and opens
 *     it, which is what actually gets the message to WhatsApp for free.
 *
 * Configure in application.properties:
 *   whatsapp.shop.phone=917259000552   (fallback only, see above)
 *   whatsapp.api.url=https://api.wati.io/api/v1/sendSessionMessage
 *   whatsapp.api.token=YOUR_TOKEN
 *   whatsapp.enabled=true
 */
@Service
public class WhatsAppNotificationService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppNotificationService.class);

    // Fallback only — used when a shop hasn't set its own phone number
    // (Shop.phone). BizKart is multi-tenant: this property must NOT be the
    // primary source, or every shop's order notifications converge on one
    // number regardless of which shop actually received the order.
    @Value("${whatsapp.shop.phone:}")
    private String fallbackPhone;

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
     * Normalize any phone string to a bare digits-only number with the Indian
     * country code prefixed (e.g. "7259000552" or "+91 72590 00552" both
     * become "917259000552"). Used consistently by both the wa.me link and
     * the BSP API payload — previously only buildWaLink() did this, so a
     * real BSP integration would have silently received un-prefixed numbers.
     */
    private String normalizePhone(String phone) {
        String clean = phone.replaceAll("\\D", "");
        return clean.startsWith("91") ? clean : "91" + clean;
    }

    /**
     * Resolve which phone number should receive this order's notification.
     * The shop's own number (set on the Shop record) always wins — this is a
     * multi-tenant platform, so a global fallback number must never be the
     * primary source or every shop's notifications converge on one inbox.
     * The `whatsapp.shop.phone` property is only a fallback for shops that
     * haven't configured their own number yet.
     */
    public String resolvePhone(OnlineOrder order) {
        String shopPhone = order.getShop() != null ? order.getShop().getPhone() : null;
        if (shopPhone != null && !shopPhone.isBlank()) return shopPhone;
        return fallbackPhone;
    }

    /**
     * Build a wa.me URL for manual sending (used by frontend fallback).
     */
    public String buildWaLink(String phone, OnlineOrder order) {
        String num = normalizePhone(phone);
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
        String phone = resolvePhone(order);
        if (!enabled || phone == null || phone.isBlank()) {
            log.warn("WhatsApp notification skipped for order {} — enabled={}, shop phone set={}. " +
                    "Set a phone number on the shop (or whatsapp.shop.phone as a fallback) to enable notifications.",
                    order.getOrderNumber(), enabled, phone != null && !phone.isBlank());
            return;
        }

        String message = buildOrderMessage(order);

        if (apiUrl != null && !apiUrl.isBlank() && apiToken != null && !apiToken.isBlank()) {
            sendViaBSP(message, phone, order.getOrderNumber());
        } else {
            // No BSP configured (whatsapp.api.url/token blank) — there is no
            // automated delivery mechanism in that case. This log line alone
            // does NOT notify anyone; the admin must use the "Notify via
            // WhatsApp" button in the Online Orders page (or GET
            // /api/whatsapp/order/{id}/link) to actually open this link.
            log.info("WhatsApp wa.me link for order {}: {}", order.getOrderNumber(), buildWaLink(phone, order));
        }
    }

    /**
     * Resolve the CUSTOMER's phone number for status-update notifications.
     * Unlike resolvePhone() (which targets the shop's own number, used for
     * new-order alerts to the shop owner), status updates must reach the
     * customer who placed the order — this was the missing half of the
     * WhatsApp integration: the shop got notified, the customer never did.
     */
    public String resolveCustomerPhone(OnlineOrder order) {
        if (order.getCustomerAccount() != null
                && order.getCustomerAccount().getPhone() != null
                && !order.getCustomerAccount().getPhone().isBlank()) {
            return order.getCustomerAccount().getPhone();
        }
        return null;
    }

    private static String statusLabel(OnlineOrder.OrderStatus status) {
        switch (status) {
            case PLACED: return "Order Placed";
            case CONFIRMED: return "Order Confirmed";
            case PREPARING: return "Being Prepared";
            case READY: return "Ready for Pickup";
            case OUT_FOR_DELIVERY: return "Out for Delivery";
            case DELIVERED: return "Delivered";
            case PICKED_UP: return "Picked Up";
            case CANCELLED: return "Cancelled";
            case REFUNDED: return "Refunded";
            default: return status.name();
        }
    }

    /**
     * Build the customer-facing status-update message. Kept separate from
     * buildOrderMessage() (which is the shop-facing "new order" alert).
     */
    public String buildStatusUpdateMessage(OnlineOrder order) {
        StringBuilder sb = new StringBuilder();
        sb.append("📦 *Order Update*\n\n");
        sb.append("Order: ").append(order.getOrderNumber()).append("\n");
        sb.append("Status: *").append(statusLabel(order.getStatus())).append("*\n");

        if (order.getStatus() == OnlineOrder.OrderStatus.OUT_FOR_DELIVERY) {
            sb.append("Your order is on its way!\n");
        } else if (order.getStatus() == OnlineOrder.OrderStatus.DELIVERED
                || order.getStatus() == OnlineOrder.OrderStatus.PICKED_UP) {
            sb.append("Your order has been delivered. Enjoy!\n");
        } else if (order.getStatus() == OnlineOrder.OrderStatus.CONFIRMED
                && order.getEstimatedReadyAt() != null) {
            sb.append("Estimated ready by: ").append(order.getEstimatedReadyAt()).append("\n");
        }

        sb.append("\nTotal: ₹").append(order.getTotalAmount()).append("\n");
        sb.append("Thank you for shopping with us!");
        return sb.toString();
    }

    /**
     * Notify the CUSTOMER of an order status change. Unlike notifyNewOrder()
     * (shop-facing), this targets the customer's own phone. Intended to be
     * called only for key milestones (Confirmed, Out for Delivery,
     * Delivered) — see OnlineOrderService.updateStatus — not every
     * intermediate status, to avoid spamming the customer.
     */
    public void notifyCustomerStatusUpdate(OnlineOrder order) {
        String phone = resolveCustomerPhone(order);
        if (!enabled || phone == null || phone.isBlank()) {
            log.warn("WhatsApp status update skipped for order {} — enabled={}, customer phone set={}.",
                    order.getOrderNumber(), enabled, phone != null && !phone.isBlank());
            return;
        }

        String message = buildStatusUpdateMessage(order);

        if (apiUrl != null && !apiUrl.isBlank() && apiToken != null && !apiToken.isBlank()) {
            sendViaBSP(message, phone, order.getOrderNumber());
        } else {
            // No BSP configured — same limitation as notifyNewOrder(): log
            // the link server-side. A configured BSP is required for this to
            // actually deliver automatically without a manual click.
            log.info("WhatsApp status wa.me link for order {} (customer): {}",
                    order.getOrderNumber(), buildWaLinkForMessage(phone, message));
        }
    }

    private String buildWaLinkForMessage(String phone, String message) {
        String num = normalizePhone(phone);
        try {
            String msg = java.net.URLEncoder.encode(message, "UTF-8");
            return "https://wa.me/" + num + "?text=" + msg;
        } catch (Exception e) {
            return "https://wa.me/" + num;
        }
    }

    private void sendViaBSP(String message, String phone, String orderNumber) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + apiToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, String> body = new HashMap<>();
            body.put("whatsappNumber", normalizePhone(phone));
            body.put("messageText", message);

            HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(apiUrl, request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("WhatsApp notification sent successfully for order {} to {}", orderNumber, phone);
            } else {
                log.warn("WhatsApp API returned non-success for order {}: {} — {}",
                        orderNumber, response.getStatusCode(), response.getBody());
            }
        } catch (Exception e) {
            // Logged with full context (order number + exception) instead of
            // just the message string, so a real failure is actually
            // diagnosable instead of vanishing into a one-line log entry.
            log.error("Failed to send WhatsApp notification for order {}: {}", orderNumber, e.getMessage(), e);
        }
    }
}
