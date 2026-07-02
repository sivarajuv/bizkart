package com.bizkart.service;

import com.bizkart.model.*;
import com.bizkart.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.List;

@Service
public class ScheduledOrderService {

    private final ScheduledOrderRepository scheduledOrderRepo;
    private final CustomerAccountRepository customerRepo;
    private final ShopRepository shopRepo;
    private final DeliveryAddressRepository addressRepo;

    public ScheduledOrderService(
        ScheduledOrderRepository scheduledOrderRepo,
        CustomerAccountRepository customerRepo,
        ShopRepository shopRepo,
        DeliveryAddressRepository addressRepo
    ) {
        this.scheduledOrderRepo = scheduledOrderRepo;
        this.customerRepo       = customerRepo;
        this.shopRepo           = shopRepo;
        this.addressRepo        = addressRepo;
    }

    public record CreateScheduledOrderRequest(
        Long shopId,
        String frequency,
        Short dayOfWeek,
        String deliveryTime,
        String orderType,
        Long deliveryAddressId,
        String itemsJson
    ) {}

    @Transactional
    public ScheduledOrder create(Long customerId, CreateScheduledOrderRequest req) {
        CustomerAccount customer = customerRepo.findById(customerId)
            .orElseThrow(() -> new RuntimeException("Customer not found"));
        Shop shop = shopRepo.findById(req.shopId())
            .orElseThrow(() -> new RuntimeException("Shop not found"));

        ScheduledOrder so = new ScheduledOrder();
        so.setCustomerAccount(customer);
        so.setShop(shop);
        so.setFrequency(ScheduledOrder.Frequency.valueOf(req.frequency()));
        so.setDayOfWeek(req.dayOfWeek());
        so.setDeliveryTime(req.deliveryTime());
        so.setOrderType(OnlineOrder.OrderType.valueOf(req.orderType()));
        so.setItemsJson(req.itemsJson());
        so.setActive(true);

        if (req.deliveryAddressId() != null) {
            addressRepo.findById(req.deliveryAddressId())
                .ifPresent(so::setDeliveryAddress);
        }

        so.setNextRunAt(computeNextRun(so));
        return scheduledOrderRepo.save(so);
    }

    public List<ScheduledOrder> listByCustomer(Long customerId) {
        return scheduledOrderRepo.findByCustomerAccountIdOrderByCreatedAtDesc(customerId);
    }

    @Transactional
    public ScheduledOrder cancel(Long id, Long customerId) {
        ScheduledOrder so = scheduledOrderRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Scheduled order not found"));
        if (!so.getCustomerAccount().getId().equals(customerId)) {
            throw new RuntimeException("Access denied");
        }
        so.setActive(false);
        return scheduledOrderRepo.save(so);
    }

    /** Compute the next scheduled run time from now */
    public LocalDateTime computeNextRun(ScheduledOrder so) {
        String[] parts = so.getDeliveryTime().split(":");
        int hour = Integer.parseInt(parts[0]);
        int min  = Integer.parseInt(parts[1]);

        LocalDate today = LocalDate.now();
        LocalTime runTime = LocalTime.of(hour, min);

        if (so.getFrequency() == ScheduledOrder.Frequency.DAILY) {
            LocalDateTime candidate = LocalDateTime.of(today, runTime);
            if (candidate.isBefore(LocalDateTime.now())) {
                candidate = candidate.plusDays(1);
            }
            return candidate;
        } else {
            // WEEKLY
            int targetDow = so.getDayOfWeek() != null ? so.getDayOfWeek() : 1;
            DayOfWeek targetDay = DayOfWeek.of(targetDow);
            LocalDate next = today.with(java.time.temporal.TemporalAdjusters.nextOrSame(targetDay));
            LocalDateTime candidate = LocalDateTime.of(next, runTime);
            if (candidate.isBefore(LocalDateTime.now())) {
                candidate = candidate.plusWeeks(1);
            }
            return candidate;
        }
    }
}
