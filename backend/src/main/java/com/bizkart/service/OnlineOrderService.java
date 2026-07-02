package com.bizkart.service;

import com.bizkart.model.*;
import com.bizkart.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class OnlineOrderService {

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

        // Trigger WhatsApp notification
        try {
            if (whatsAppService != null) {
                whatsAppService.notifyNewOrder(finalOrder);
            }
        } catch (Exception e) {
            // Non-blocking — don't fail the order if notification fails
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
