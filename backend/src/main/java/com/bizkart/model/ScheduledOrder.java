package com.bizkart.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "scheduled_orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScheduledOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "customer_account_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "passwordHash"})
    private CustomerAccount customerAccount;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "shop_id", nullable = false)
    @JsonIgnoreProperties({"users", "products", "hibernateLazyInitializer", "handler"})
    private Shop shop;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Frequency frequency;

    private Short dayOfWeek;       // 1=Mon..7=Sun, null for DAILY

    @Column(nullable = false, length = 5)
    private String deliveryTime;   // HH:mm

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OnlineOrder.OrderType orderType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delivery_address_id")
    @JsonIgnoreProperties({"customerAccount", "hibernateLazyInitializer", "handler"})
    private DeliveryAddress deliveryAddress;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String itemsJson;      // JSON [{productId, quantity}]

    @Column(nullable = false)
    private boolean active = true;

    private LocalDateTime lastRunAt;
    private LocalDateTime nextRunAt;
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum Frequency { DAILY, WEEKLY }
}
