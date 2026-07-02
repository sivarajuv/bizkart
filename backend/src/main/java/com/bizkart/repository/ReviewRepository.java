package com.bizkart.repository;

import com.bizkart.model.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findByShopIdAndProductIdIsNullOrderByCreatedAtDesc(Long shopId);
    List<Review> findByProductIdOrderByCreatedAtDesc(Long productId);
    Optional<Review> findByOnlineOrderIdAndProductId(Long orderId, Long productId);
    Optional<Review> findByOnlineOrderIdAndProductIdIsNull(Long orderId);

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM Review r WHERE r.shop.id = :shopId AND r.product IS NULL")
    double avgShopRating(@Param("shopId") Long shopId);

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM Review r WHERE r.product.id = :productId")
    double avgProductRating(@Param("productId") Long productId);

    @Query("SELECT COUNT(r) FROM Review r WHERE r.onlineOrder.id = :orderId")
    long countByOrderId(@Param("orderId") Long orderId);
}
