package com.bizkart.service;

import com.bizkart.model.*;
import com.bizkart.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class OnlineOrderService {

    private static final Logger log = LoggerFactory.getLogger(OnlineOrderService.class);

    private final OnlineOrderRepository orderRepo;
    private final ProductRepository productRepo;
    private final CustomerAccountRepository customerRepo;
    private final ShopRepository shopRepo;

    private static final BigDecimal DELIVERY_FEE = new BigDecimal("30");

    @Autowired(required = false)
    private WhatsAppNotificationService whatsAppService;

    @Autowired(required = false)
    private CouponService couponService;

    @Autowired(required = false)
    private LoyaltyService loyaltyService;

    public OnlineOrderService(
        OnlineOrderRepository orderRepo,
        ProductRepository productRepo,
        CustomerAccountRepository customerRepo,
        ShopRepository shopRepo
    ) {
        this.orderRepo    = orderRepo;
        this.productRepo  = productRepo;
        this.customerRepo = customerRepo;
        this.shopRepo     = shopRepo;
    }

    public record CartItemRequest(Long productId, int quantity) {}

    public record PlaceOrderRequest(
        Long shopId,
        OnlineOrder.OrderType orderType,
        String deliveryAddress,
        OnlineOrder.PaymentMethod paymentMethod,
        String paymentReference,
        String customerNotes,
        String couponCode,
        Integer loyaltyPointsToRedeem,
        List<CartItemRequest> items
    ) {}

    @Transactional
    public OnlineOrder placeOrder(Long customerAccountId, PlaceOrderRequest req) {
        CustomerAccount customer = customerRepo.findById(customerAccountId)
            .orElseThrow(() -> new RuntimeException("Customer not found"));

        Shop shop = shopRepo.findById(req.shopId())
            .orElseThrow(() -> new RuntimeException("Shop not found: " + req.shopId()));

        if (req.items() == null || req.items().isEmpty())
            throw new RuntimeException("Cart is empty");

        if (req.orderType() == OnlineOrder.OrderType.DELIVERY && isBlank(req.deliveryAddress()))
            throw new RuntimeException("Delivery address is required");

        OnlineOrder order = new OnlineOrder();
        order.setOrderNumber("ONL-" +
            shop.getCode().toUpperCase().replace("-", "") + "-" + System.currentTimeMillis());
        order.setShop(shop);
        order.setCustomerAccount(customer);
        order.setOrderType(req.orderType());
        order.setDeliveryAddressText(req.deliveryAddress());
        order.setPaymentMethod(
            req.paymentMethod() != null ? req.paymentMethod() : OnlineOrder.PaymentMethod.COD);
        order.setPaymentReference(req.paymentReference());
        order.setCustomerNotes(req.customerNotes());
        order.setStatus(OnlineOrder.OrderStatus.PLACED);
        order.setPaymentStatus(
            order.getPaymentMethod() == OnlineOrder.PaymentMethod.COD
                ? OnlineOrder.PaymentStatus.PENDING
                : OnlineOrder.PaymentStatus.PAID
        );

        OnlineOrder savedOrder = orderRepo.save(order);

        // Build items and calculate subtotal
        List<OnlineOrderItem> orderItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (CartItemRequest ci : req.items()) {
            Product p = productRepo.findByIdAndShopId(ci.productId(), shop.getId())
                .orElseThrow(() -> new RuntimeException("Product not found: " + ci.productId()));

            if (p.getStock() < ci.quantity())
                throw new RuntimeException("Insufficient stock for: " + p.getName());

            OnlineOrderItem item = new OnlineOrderItem();
            item.setOnlineOrder(savedOrder);
            item.setProduct(p);
            item.setProductName(p.getName());
            item.setUnitPrice(p.getPrice());
            item.setQuantity(ci.quantity());
            BigDecimal lineSub = p.getPrice().multiply(BigDecimal.valueOf(ci.quantity()));
            item.setSubtotal(lineSub);
            subtotal = subtotal.add(lineSub);

            p.setStock(p.getStock() - ci.quantity());
            productRepo.save(p);
            orderItems.add(item);
        }

        BigDecimal fee = req.orderType() == OnlineOrder.OrderType.DELIVERY
            ? DELIVERY_FEE : BigDecimal.ZERO;

        // ── Coupon discount ──────────────────────────────────────────────
        BigDecimal couponDiscount = BigDecimal.ZERO;
        String appliedCouponCode  = null;
        if (couponService != null && req.couponCode() != null && !req.couponCode().isBlank()) {
            try {
                var couponResult = couponService.validateAndCompute(
                    req.couponCode(), subtotal, req.shopId(), customer);
                couponDiscount   = (BigDecimal) couponResult.get("discount");
                appliedCouponCode = (String) couponResult.get("code");
            } catch (RuntimeException e) {
                throw new RuntimeException("Coupon error: " + e.getMessage());
            }
        }

        // ── Loyalty points redemption ─────────────────────────────────────
        int pointsToRedeem = 0;
        BigDecimal loyaltyDiscount = BigDecimal.ZERO;
        if (loyaltyService != null && req.loyaltyPointsToRedeem() != null
                && req.loyaltyPointsToRedeem() > 0) {
            int maxAllowed = loyaltyService.maxRedeemable(customer, subtotal.add(fee).subtract(couponDiscount));
            pointsToRedeem = Math.min(req.loyaltyPointsToRedeem(), maxAllowed);
            loyaltyDiscount = loyaltyService.pointsToRupees(pointsToRedeem);
            loyaltyService.deductPoints(customerAccountId, pointsToRedeem);
        }

        BigDecimal totalDiscount = couponDiscount.add(loyaltyDiscount);
        BigDecimal total = subtotal.add(fee).subtract(totalDiscount).max(BigDecimal.ZERO);

        // ── Loyalty points earned (1 per ₹10 of final total) ─────────────
        int pointsEarned = loyaltyService != null ? loyaltyService.computeEarned(total) : 0;

        savedOrder.setSubtotal(subtotal);
        savedOrder.setDeliveryFee(fee);
        savedOrder.setDiscount(totalDiscount);
        savedOrder.setCouponCode(appliedCouponCode);
        savedOrder.setCouponDiscount(couponDiscount);
        savedOrder.setLoyaltyPointsUsed(pointsToRedeem);
        savedOrder.setLoyaltyPointsEarned(pointsEarned);
        savedOrder.setTotalAmount(total);
        savedOrder.setItems(orderItems);

        // Initial status history entry
        OnlineOrderStatusHistory hist = new OnlineOrderStatusHistory();
        hist.setOnlineOrder(savedOrder);
        hist.setStatus(OnlineOrder.OrderStatus.PLACED);
        hist.setNote("Order received");
        savedOrder.getStatusHistory().add(hist);

        OnlineOrder finalOrder = orderRepo.save(savedOrder);

        // Record coupon usage
        try {
            if (couponService != null && appliedCouponCode != null)
                couponService.recordUsage(appliedCouponCode);
        } catch (Exception ignored) {}

        // Credit earned loyalty points
        try {
            if (loyaltyService != null && pointsEarned > 0)
                loyaltyService.addPoints(customerAccountId, pointsEarned);
        } catch (Exception ignored) {}

        // Trigger WhatsApp notification — non-blocking (a notification failure
        // must never fail the order itself), but the failure is now actually
        // logged instead of silently vanishing, so it's diagnosable.
        try {
            if (whatsAppService != null) {
                whatsAppService.notifyNewOrder(finalOrder);
            }
        } catch (Exception e) {
            log.error("WhatsApp notification failed for order {}: {}", finalOrder.getOrderNumber(), e.getMessage(), e);
        }

        return finalOrder;
    }

    @Transactional
    public OnlineOrder updateStatus(
        Long orderId,
        OnlineOrder.OrderStatus newStatus,
        Long changedByUserId,
        String note
    ) {
        OnlineOrder order = orderRepo.findById(orderId)
            .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));

        order.setStatus(newStatus);

        if (newStatus == OnlineOrder.OrderStatus.DELIVERED
                || newStatus == OnlineOrder.OrderStatus.PICKED_UP) {
            order.setDeliveredAt(LocalDateTime.now());
        }
        if (newStatus == OnlineOrder.OrderStatus.CONFIRMED) {
            int mins = order.getOrderType() == OnlineOrder.OrderType.DELIVERY ? 45 : 20;
            order.setEstimatedReadyAt(LocalDateTime.now().plusMinutes(mins));
        }

        OnlineOrderStatusHistory entry = new OnlineOrderStatusHistory();
        entry.setOnlineOrder(order);
        entry.setStatus(newStatus);
        entry.setNote(note);
        if (changedByUserId != null) {
            User u = new User();
            u.setId(changedByUserId);
            entry.setChangedBy(u);
        }
        order.getStatusHistory().add(entry);

        OnlineOrder saved = orderRepo.save(order);

        // Notify the CUSTOMER on key milestones only (not every intermediate
        // status) — avoids spamming while still keeping them informed at the
        // stages that matter. Non-blocking: a notification failure must
        // never fail the status update itself.
        if (whatsAppService != null && (
                newStatus == OnlineOrder.OrderStatus.CONFIRMED
                || newStatus == OnlineOrder.OrderStatus.OUT_FOR_DELIVERY
                || newStatus == OnlineOrder.OrderStatus.DELIVERED
                || newStatus == OnlineOrder.OrderStatus.PICKED_UP)) {
            try {
                whatsAppService.notifyCustomerStatusUpdate(saved);
            } catch (Exception e) {
                log.error("WhatsApp status notification failed for order {}: {}",
                        saved.getOrderNumber(), e.getMessage(), e);
            }
        }

        return saved;
    }

    /**
     * Apply (or replace) a manual discount on an order's total — flat rupee
     * amount or percent of the order value — independent of coupon codes.
     * Recomputed from the order's fixed components (subtotal + deliveryFee
     * - couponCode/loyalty discount) each time, so calling this twice with
     * different values replaces rather than compounds the discount.
     * Pass value=null / type=null to clear an existing manual discount.
     */
    @Transactional
    public OnlineOrder applyManualDiscount(
        Long orderId,
        OnlineOrder.ManualDiscountType type,
        BigDecimal value
    ) {
        OnlineOrder order = orderRepo.findById(orderId)
            .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));

        BigDecimal preDiscountTotal = order.getSubtotal()
            .add(order.getDeliveryFee())
            .subtract(order.getDiscount());
        if (preDiscountTotal.compareTo(BigDecimal.ZERO) < 0) preDiscountTotal = BigDecimal.ZERO;

        BigDecimal manualAmount = BigDecimal.ZERO;
        if (type != null && value != null) {
            if (value.compareTo(BigDecimal.ZERO) < 0) {
                throw new RuntimeException("Discount value must be positive");
            }
            if (type == OnlineOrder.ManualDiscountType.PERCENT) {
                if (value.compareTo(new BigDecimal("100")) > 0) {
                    throw new RuntimeException("Percentage discount cannot exceed 100%");
                }
                manualAmount = preDiscountTotal.multiply(value)
                    .divide(new BigDecimal("100"));
            } else {
                manualAmount = value;
            }
            // Never let the discount exceed the order value itself.
            if (manualAmount.compareTo(preDiscountTotal) > 0) {
                manualAmount = preDiscountTotal;
            }
        }

        order.setManualDiscountType(type);
        order.setManualDiscountValue(value);
        order.setManualDiscountAmount(manualAmount);
        order.setTotalAmount(preDiscountTotal.subtract(manualAmount).max(BigDecimal.ZERO));

        return orderRepo.save(order);
    }

    public List<OnlineOrder> getMyOrders(Long customerAccountId) {
        return orderRepo.findByCustomerAccountIdOrderByCreatedAtDesc(customerAccountId);
    }

    public OnlineOrder getOrder(Long id) {
        return orderRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Order not found: " + id));
    }

    public List<OnlineOrder> getActiveOrdersForShop(Long shopId) {
        return orderRepo.findActiveOrdersByShop(shopId);
    }

    public List<OnlineOrder> getAllOrdersForShop(Long shopId) {
        return orderRepo.findByShopIdOrderByCreatedAtDesc(shopId);
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
