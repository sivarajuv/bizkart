package com.bizkart.controller;

import com.bizkart.model.OnlineOrder;
import com.bizkart.repository.CustomerAccountRepository;
import com.bizkart.repository.OnlineOrderRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/analytics")
public class AnalyticsController {

    private final OnlineOrderRepository orderRepo;
    private final CustomerAccountRepository customerRepo;

    public AnalyticsController(OnlineOrderRepository orderRepo, CustomerAccountRepository customerRepo) {
        this.orderRepo    = orderRepo;
        this.customerRepo = customerRepo;
    }

    @GetMapping("/customers")
    public ResponseEntity<?> customerAnalytics() {
        List<OnlineOrder> allOrders = orderRepo.findAll();

        // Group orders by customer
        Map<Long, List<OnlineOrder>> byCustomer = allOrders.stream()
            .filter(o -> o.getStatus() != OnlineOrder.OrderStatus.CANCELLED
                      && o.getStatus() != OnlineOrder.OrderStatus.REFUNDED)
            .collect(Collectors.groupingBy(o -> o.getCustomerAccount().getId()));

        // Top customers by revenue
        List<Map<String, Object>> topCustomers = byCustomer.entrySet().stream()
            .map(e -> {
                Long customerId = e.getKey();
                List<OnlineOrder> orders = e.getValue();
                BigDecimal totalSpend = orders.stream()
                    .map(OnlineOrder::getTotalAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                String name  = orders.get(0).getCustomerAccount().getName();
                String phone = orders.get(0).getCustomerAccount().getPhone();
                LocalDateTime last = orders.stream()
                    .map(OnlineOrder::getCreatedAt)
                    .filter(Objects::nonNull)
                    .max(Comparator.naturalOrder()).orElse(null);
                Map<String, Object> m = new HashMap<>();
                m.put("customerId",  customerId);
                m.put("name",        name);
                m.put("phone",       phone);
                m.put("orderCount",  orders.size());
                m.put("totalSpend",  totalSpend);
                m.put("lastOrderAt", last);
                return m;
            })
            .sorted((a, b) -> ((BigDecimal)b.get("totalSpend")).compareTo((BigDecimal)a.get("totalSpend")))
            .limit(20)
            .collect(Collectors.toList());

        // Orders by hour (best-selling hours)
        Map<Integer, Long> hourCounts = allOrders.stream()
            .filter(o -> o.getCreatedAt() != null)
            .collect(Collectors.groupingBy(o -> o.getCreatedAt().getHour(), Collectors.counting()));

        // Churn risk: customers with no order in last 30 days but had orders before
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        List<Map<String, Object>> churnRisk = byCustomer.entrySet().stream()
            .filter(e -> {
                Optional<LocalDateTime> lastOrder = e.getValue().stream()
                    .map(OnlineOrder::getCreatedAt).filter(Objects::nonNull)
                    .max(Comparator.naturalOrder());
                return lastOrder.isPresent() && lastOrder.get().isBefore(thirtyDaysAgo);
            })
            .map(e -> {
                List<OnlineOrder> orders = e.getValue();
                Optional<LocalDateTime> last = orders.stream()
                    .map(OnlineOrder::getCreatedAt).filter(Objects::nonNull)
                    .max(Comparator.naturalOrder());
                Map<String, Object> m = new HashMap<>();
                m.put("customerId", e.getKey());
                m.put("name",       orders.get(0).getCustomerAccount().getName());
                m.put("phone",      orders.get(0).getCustomerAccount().getPhone());
                m.put("orderCount", orders.size());
                m.put("lastOrderAt",last.orElse(null));
                return m;
            })
            .limit(20)
            .collect(Collectors.toList());

        // Summary stats
        long totalCustomers    = customerRepo.count();
        long activeCustomers   = byCustomer.size();
        long newThisMonth      = customerRepo.findAll().stream()
            .filter(c -> c.getCreatedAt() != null && c.getCreatedAt().isAfter(LocalDateTime.now().minusDays(30)))
            .count();

        return ResponseEntity.ok(Map.of(
            "summary", Map.of(
                "totalCustomers",  totalCustomers,
                "activeCustomers", activeCustomers,
                "newThisMonth",    newThisMonth,
                "churnRiskCount",  churnRisk.size()
            ),
            "topCustomers",  topCustomers,
            "ordersByHour",  hourCounts,
            "churnRisk",     churnRisk
        ));
    }
}
