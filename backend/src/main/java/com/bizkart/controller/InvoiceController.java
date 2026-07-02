package com.bizkart.controller;

import com.bizkart.model.OnlineOrder;
import com.bizkart.model.OnlineOrderItem;
import com.bizkart.repository.OnlineOrderRepository;
import com.bizkart.security.JwtUtils;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/portal/orders")
public class InvoiceController {

    private final OnlineOrderRepository orderRepo;
    private final JwtUtils jwtUtils;

    public InvoiceController(OnlineOrderRepository orderRepo, JwtUtils jwtUtils) {
        this.orderRepo = orderRepo;
        this.jwtUtils  = jwtUtils;
    }

    /**
     * Accept token from either:
     *   - Authorization header (API calls)
     *   - ?token= query param (browser tab direct open / <a href> links)
     */
    @GetMapping(value = "/{id}/invoice", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> getInvoice(
        @PathVariable Long id,
        @RequestHeader(value = "Authorization", required = false) String authHeader,
        @RequestParam(value = "token", required = false) String tokenParam
    ) {
        try {
            String raw = null;
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                raw = authHeader.substring(7);
            } else if (tokenParam != null && !tokenParam.isBlank()) {
                raw = tokenParam;
            }
            if (raw == null) {
                return ResponseEntity.status(401)
                    .body("<h3>Unauthorized – please open the invoice from the app</h3>");
            }
            Long customerId = jwtUtils.getCustomerIdFromToken(raw);
            OnlineOrder order = orderRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
            if (!order.getCustomerAccount().getId().equals(customerId)) {
                return ResponseEntity.status(403).body("<h3>Access denied</h3>");
            }
            return ResponseEntity.ok(buildInvoiceHtml(order));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body("<h3>Error: " + e.getMessage() + "</h3>");
        }
    }

    private String buildInvoiceHtml(OnlineOrder o) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");
        StringBuilder rows = new StringBuilder();
        for (OnlineOrderItem item : o.getItems()) {
            rows.append(String.format(
                    "<tr><td>%s</td><td style='text-align:center'>%d</td><td style='text-align:right'>₹%.2f</td><td style='text-align:right'>₹%.2f</td></tr>",
                    item.getProductName(), item.getQuantity(),
                    item.getUnitPrice(), item.getSubtotal()
            ));
        }

        // The template below has 16 "%s"/"%.2f" placeholders total. The previous
        // version only supplied 12 arguments to .formatted(...) — every invoice
        // hit a MissingFormatArgumentException ("Format specifier '%s'") as soon
        // as it reached the coupon/loyalty/total/footer placeholders, which is
        // exactly the "Error format Specifier %s" the customer app was showing.
        // Building the two optional discount rows as their own HTML snippets
        // (empty string when not applicable) keeps every row a well-formed
        // <tr>...</tr> instead of splicing a bare number into the table.
        String couponRow = o.getCouponDiscount() != null && o.getCouponDiscount().signum() > 0
                ? String.format(
                    "<tr><td>Coupon%s</td><td style='text-align:right'>−₹%.2f</td></tr>",
                    o.getCouponCode() != null ? " (" + o.getCouponCode() + ")" : "",
                    o.getCouponDiscount())
                : "";

        java.math.BigDecimal loyaltyDiscount = o.getDiscount() != null
                ? o.getDiscount().subtract(o.getCouponDiscount() != null ? o.getCouponDiscount() : java.math.BigDecimal.ZERO)
                : java.math.BigDecimal.ZERO;
        String loyaltyRow = o.getLoyaltyPointsUsed() > 0 && loyaltyDiscount.signum() > 0
                ? String.format(
                    "<tr><td>Loyalty (%d pts)</td><td style='text-align:right'>−₹%.2f</td></tr>",
                    o.getLoyaltyPointsUsed(), loyaltyDiscount)
                : "";

        String orderDate = o.getCreatedAt() != null ? o.getCreatedAt().format(fmt) : "";
        String paymentMethod = o.getPaymentMethod() != null ? o.getPaymentMethod().name() : "";

        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8"/>
                  <title>Invoice – %s</title>
                  <style>
                    body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#111}
                    h1{font-size:28px;color:#16a34a;margin:0}
                    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px}
                    .badge{background:#f0fdf4;border:1px solid #bbf7d0;padding:4px 14px;border-radius:20px;font-size:13px;color:#166534;font-weight:600}
                    table{width:100%%;border-collapse:collapse;margin-top:20px}
                    th{background:#f9fafb;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb}
                    td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:14px}
                    .totals{margin-top:20px;display:flex;justify-content:flex-end}
                    .totals table{max-width:300px}
                    .totals td{border:none;padding:6px 12px}
                    .grand-total td{font-weight:700;font-size:16px;border-top:2px solid #111}
                    .footer{margin-top:40px;text-align:center;color:#9ca3af;font-size:12px}
                    @media print{.no-print{display:none}}
                  </style>
                </head>
                <body>
                  <div class="header">
                    <div>
                      <h1>🛒 BizKart</h1>
                      <div style="color:#6b7280;font-size:13px;margin-top:4px">%s</div>
                    </div>
                    <div style="text-align:right">
                      <div style="font-size:20px;font-weight:800">Invoice</div>
                      <div style="color:#6b7280;font-size:13px;margin-top:4px">#%s</div>
                      <div style="margin-top:8px"><span class="badge">%s</span></div>
                    </div>
                  </div>
                
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;background:#f9fafb;padding:16px;border-radius:10px">
                    <div>
                      <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600">Billed To</div>
                      <div style="font-weight:700;margin-top:4px">%s</div>
                      <div style="color:#6b7280;font-size:13px">%s</div>
                    </div>
                    <div>
                      <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600">From</div>
                      <div style="font-weight:700;margin-top:4px">%s</div>
                      <div style="color:#6b7280;font-size:13px">%s</div>
                    </div>
                  </div>
                
                  <table>
                    <thead><tr>
                      <th>Item</th><th style="text-align:center">Qty</th>
                      <th style="text-align:right">Unit Price</th>
                      <th style="text-align:right">Amount</th>
                    </tr></thead>
                    <tbody>%s</tbody>
                  </table>
                
                  <div class="totals">
                    <table>
                      <tr><td>Subtotal</td><td style="text-align:right">₹%.2f</td></tr>
                      <tr><td>Delivery Fee</td><td style="text-align:right">₹%.2f</td></tr>
                      %s
                      %s
                      <tr class="grand-total"><td>Total</td><td style="text-align:right">₹%.2f</td></tr>
                    </table>
                  </div>
                
                  <div style="margin-top:24px;text-align:right">
                    <button class="no-print" onclick="window.print()"
                      style="background:#16a34a;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer">
                      🖨 Print / Save PDF
                    </button>
                  </div>
                
                  <div class="footer">
                    <div>Thank you for shopping with BizKart!</div>
                    <div style="margin-top:4px">Order placed on %s · Payment: %s</div>
                  </div>
                </body>
                </html>
                """.formatted(
                o.getOrderNumber(),
                o.getShop().getName(),
                o.getOrderNumber(),
                o.getStatus().name().replace("_", " "),
                o.getCustomerAccount().getName(),
                o.getCustomerAccount().getPhone(),
                o.getShop().getName(),
                o.getShop().getAddress() != null ? o.getShop().getAddress() : "",
                rows.toString(),
                o.getSubtotal(),
                o.getDeliveryFee(),
                couponRow,
                loyaltyRow,
                o.getTotalAmount(),
                orderDate,
                paymentMethod);
    }
}