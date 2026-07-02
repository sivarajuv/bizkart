package com.bizkart.repository;

import com.bizkart.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByShopIdOrderByNameAsc(Long shopId);
    List<Product> findByShopIdAndCategoryOrderByNameAsc(Long shopId, String category);
    List<Product> findByShopIdAndNameContainingIgnoreCaseOrderByNameAsc(Long shopId, String name);
    Optional<Product> findByIdAndShopId(Long id, Long shopId);

    @Query("SELECT DISTINCT p.category FROM Product p ORDER BY p.category")
    List<String> findAllCategories();

    @Query("SELECT DISTINCT p.category FROM Product p WHERE p.shop.id = :shopId ORDER BY p.category")
    List<String> findCategoriesByShopId(@Param("shopId") Long shopId);
}
