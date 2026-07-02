package com.bizkart.repository;

import com.bizkart.model.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    @Query("SELECT oi.product.id, oi.product.name, oi.product.category, SUM(oi.quantity) as totalQty, SUM(oi.subtotal) as totalRevenue " +
           "FROM OrderItem oi JOIN oi.order o WHERE o.status = 'COMPLETED' " +
           "GROUP BY oi.product.id, oi.product.name, oi.product.category " +
           "ORDER BY totalQty DESC")
    List<Object[]> findTopSellingProducts();

    @Query("SELECT oi.product.id, oi.product.name, oi.product.category, SUM(oi.quantity) as totalQty, SUM(oi.subtotal) as totalRevenue " +
           "FROM OrderItem oi JOIN oi.order o WHERE o.status = 'COMPLETED' AND o.shop.id = :shopId " +
           "GROUP BY oi.product.id, oi.product.name, oi.product.category " +
           "ORDER BY totalQty DESC")
    List<Object[]> findTopSellingProductsByShopId(@Param("shopId") Long shopId);

    @Query("SELECT oi.product.category, SUM(oi.quantity) as totalQty, SUM(oi.subtotal) as totalRevenue " +
           "FROM OrderItem oi JOIN oi.order o WHERE o.status = 'COMPLETED' " +
           "GROUP BY oi.product.category ORDER BY totalRevenue DESC")
    List<Object[]> findSalesByCategory();

    @Query("SELECT oi.product.category, SUM(oi.quantity) as totalQty, SUM(oi.subtotal) as totalRevenue " +
           "FROM OrderItem oi JOIN oi.order o WHERE o.status = 'COMPLETED' AND o.shop.id = :shopId " +
           "GROUP BY oi.product.category ORDER BY totalRevenue DESC")
    List<Object[]> findSalesByCategoryByShopId(@Param("shopId") Long shopId);
}
