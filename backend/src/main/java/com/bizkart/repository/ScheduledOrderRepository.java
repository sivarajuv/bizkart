package com.bizkart.repository;

import com.bizkart.model.ScheduledOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface ScheduledOrderRepository extends JpaRepository<ScheduledOrder, Long> {

    List<ScheduledOrder> findByCustomerAccountIdOrderByCreatedAtDesc(Long customerId);

    @Query("SELECT s FROM ScheduledOrder s WHERE s.active = true AND s.nextRunAt <= :now")
    List<ScheduledOrder> findDueOrders(@Param("now") LocalDateTime now);
}
