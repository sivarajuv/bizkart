package com.bizkart.repository;

import com.bizkart.model.LedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, Long> {
    List<LedgerEntry> findAllByOrderByCreatedAtDesc();
    List<LedgerEntry> findByShopIdOrderByCreatedAtDesc(Long shopId);
    List<LedgerEntry> findByShopIdAndCustomerIdOrderByCreatedAtDesc(Long shopId, Long customerId);
}
