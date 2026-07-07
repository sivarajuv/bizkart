package com.bizkart.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "online_orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OnlineOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "shop_id", nullable = false)
    @JsonIgnoreProperties({"users", "products", "hibernateLazyInitializer", "handler"})
    private Shop shop;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "customer_account_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private CustomerAccount customerAccount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderType orderType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delivery_address_id")
    @JsonIgnoreProperties({"customerAccount", "hibernateLazyInitializer", "handler"})
    private DeliveryAddress deliveryAddress;

    @Column(columnDefinition = "TEXT")
    private String deliveryAddressText;

    @Column(nullable = false)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal deliveryFee = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(length = 60)
    private String couponCode;

    @Column(nullable = false)
    private BigDecimal couponDiscount = BigDecimal.ZERO;

    // Manual discount applied by shop staff on the order total (independent
    // of coupon codes) — either a flat rupee amount or a percentage of the
    // pre-discount total. manualDiscountAmount is the resolved rupee value,
    // stored so history/receipts don't need to recompute it later.
    @Enumerated(EnumType.STRING)
    private ManualDiscountType manualDiscountType;

    private BigDecimal manualDiscountValue;

    @Column(nullable = false)
    private BigDecimal manualDiscountAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private int loyaltyPointsUsed = 0;

    @Column(nullable = false)
    private int loyaltyPointsEarned = 0;

    @Column(nullable = false)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @Column(length = 120)
    private String paymentReference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PLACED;

    @Column(columnDefinition = "TEXT")
    private String cancellationReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_user_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "shop"})
    private User assignedTo;

    private LocalDateTime estimatedReadyAt;
    private LocalDateTime deliveredAt;

    @Column(columnDefinition = "TEXT")
    private String customerNotes;

    @Column(columnDefinition = "TEXT")
    private String internalNotes;

    @OneToMany(mappedBy = "onlineOrder", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @JsonIgnoreProperties({"onlineOrder"})
    private List<OnlineOrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "onlineOrder", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @OrderBy("createdAt ASC")
    @JsonIgnoreProperties({"onlineOrder", "changedBy"})
    private List<OnlineOrderStatusHistory> statusHistory = new ArrayList<>();

    // Live Delivery Map: agent GPS location
    private Double agentLatitude;
    private Double agentLongitude;
    private LocalDateTime agentUpdatedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum ManualDiscountType { PERCENT, FLAT }
    public enum OrderType     { DELIVERY, PICKUP }
    public enum PaymentMethod { COD, UPI, CARD }
    public enum PaymentStatus { PENDING, PAID, FAILED, REFUNDED }
    public enum OrderStatus   {
        PLACED, CONFIRMED, PREPARING, READY,
        OUT_FOR_DELIVERY, DELIVERED, PICKED_UP,
        CANCELLED, REFUNDED
    }
}
