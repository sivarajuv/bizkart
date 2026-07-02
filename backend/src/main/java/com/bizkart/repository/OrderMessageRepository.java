package com.bizkart.repository;

import com.bizkart.model.OrderMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderMessageRepository extends JpaRepository<OrderMessage, Long> {

    List<OrderMessage> findByOnlineOrderIdOrderByCreatedAtAsc(Long orderId);
}
