package com.bizkart.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "shop_id", nullable = false)
    private Shop shop;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sold_by_user_id", nullable = false)
    private User soldBy;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Column(nullable = false)
    private BigDecimal totalAmount;

    @Column(nullable = false)
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal balanceDue = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal totalCost = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal grossProfit = BigDecimal.ZERO;

    // Discount applied at time of sale (POS/pickup) — percent of the bill or
    // a flat rupee amount, resolved into discountAmount at checkout time.
    // discountAmount uses an explicit DB-level DEFAULT so that Hibernate's
    // ddl-auto=update can add this NOT NULL column to the existing (non-
    // empty) orders table without failing — see the manual_discount_amount
    // incident on online_orders for why this matters.
    @Enumerated(EnumType.STRING)
    private DiscountType discountType;

    private BigDecimal discountValue;

    @Column(nullable = false, columnDefinition = "numeric(38,2) default 0")
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    private PaymentStatus paymentStatus;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    private String customerName;
    private String customerPhone;

    // For UPI
    private String upiTransactionId;

    // For Card
    private String cardLast4;
    private String cardType;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<OrderItem> items;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum DiscountType {
        PERCENT, FLAT
    }

    public enum PaymentMethod {
        CASH, CARD, UPI, CREDIT
    }

    public enum PaymentStatus {
        PAID, PARTIAL, DUE
    }

    public enum OrderStatus {
        PENDING, COMPLETED, CANCELLED, REFUNDED
    }
}
