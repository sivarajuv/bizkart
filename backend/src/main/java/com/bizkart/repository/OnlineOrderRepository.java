package com.bizkart.repository;

import com.bizkart.model.OnlineOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface OnlineOrderRepository extends JpaRepository<OnlineOrder, Long> {

    List<OnlineOrder> findByShopIdOrderByCreatedAtDesc(Long shopId);

    List<OnlineOrder> findByCustomerAccountIdOrderByCreatedAtDesc(Long customerId);

    Optional<OnlineOrder> findByOrderNumber(String orderNumber);

    @Query("SELECT o FROM OnlineOrder o WHERE o.shop.id = :shopId " +
           "AND o.status NOT IN ('DELIVERED','PICKED_UP','CANCELLED','REFUNDED') " +
           "ORDER BY o.createdAt ASC")
    List<OnlineOrder> findActiveOrdersByShop(@Param("shopId") Long shopId);

    long countByCustomerAccountId(Long customerId);
}
