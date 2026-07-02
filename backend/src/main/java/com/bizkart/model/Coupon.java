package com.bizkart.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "coupons")
@Data
@NoArgsConstructor
public class Coupon {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id")
    private Shop shop;         // null = platform-wide

    @Column(nullable = false, unique = true, length = 60)
    private String code;

    @Column(length = 255)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DiscountType discountType = DiscountType.PERCENT;

    @Column(nullable = false)
    private BigDecimal discountValue;

    @Column(nullable = false)
    private BigDecimal minOrderValue = BigDecimal.ZERO;

    private BigDecimal maxDiscount;   // cap for PERCENT coupons

    private Integer usageLimit;       // null = unlimited
    private int usedCount = 0;

    private boolean firstOrderOnly = false;

    private LocalDateTime validFrom;
    private LocalDateTime validUntil;

    @Column(nullable = false)
    private boolean active = true;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() { createdAt = LocalDateTime.now(); }

    public enum DiscountType { PERCENT, FLAT }
}
