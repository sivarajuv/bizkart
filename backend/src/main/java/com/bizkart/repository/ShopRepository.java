package com.bizkart.repository;

import com.bizkart.model.Shop;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ShopRepository extends JpaRepository<Shop, Long> {
    Optional<Shop> findByCode(String code);
    boolean existsByCode(String code);
}
