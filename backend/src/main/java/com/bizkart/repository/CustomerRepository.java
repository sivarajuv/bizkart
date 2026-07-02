package com.bizkart.repository;

import com.bizkart.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    List<Customer> findAllByOrderByOutstandingBalanceDescNameAsc();
    List<Customer> findByShopIdOrderByOutstandingBalanceDescNameAsc(Long shopId);
    Optional<Customer> findByIdAndShopId(Long id, Long shopId);
    Optional<Customer> findByShopIdAndPhone(Long shopId, String phone);
    List<Customer> findByShopIdAndNameContainingIgnoreCaseOrderByNameAsc(Long shopId, String name);
}
