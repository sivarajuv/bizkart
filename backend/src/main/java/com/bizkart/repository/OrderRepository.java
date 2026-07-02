package com.bizkart.repository;

import com.bizkart.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    Optional<Order> findByOrderNumber(String orderNumber);
    Optional<Order> findByIdAndShopId(Long id, Long shopId);

    List<Order> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    List<Order> findByShopIdOrderByCreatedAtDesc(Long shopId);

    @Query("SELECT o FROM Order o WHERE o.status = 'COMPLETED' ORDER BY o.createdAt DESC")
    List<Order> findCompletedOrders();

    @Query("SELECT o FROM Order o WHERE o.shop.id = :shopId AND o.status = 'COMPLETED' ORDER BY o.createdAt DESC")
    List<Order> findCompletedOrdersByShopId(@Param("shopId") Long shopId);

    @Query("SELECT o FROM Order o WHERE FUNCTION('DATE', o.createdAt) = CURRENT_DATE ORDER BY o.createdAt DESC")
    List<Order> findTodaysOrders();

    @Query("SELECT o FROM Order o WHERE o.shop.id = :shopId AND FUNCTION('DATE', o.createdAt) = CURRENT_DATE ORDER BY o.createdAt DESC")
    List<Order> findTodaysOrdersByShopId(@Param("shopId") Long shopId);

    List<Order> findByShopIdAndCustomerIdOrderByCreatedAtDesc(Long shopId, Long customerId);
}
