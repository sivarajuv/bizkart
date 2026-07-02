package com.bizkart.repository;

import com.bizkart.model.CustomerAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface CustomerAccountRepository extends JpaRepository<CustomerAccount, Long> {
    Optional<CustomerAccount> findByPhone(String phone);
    boolean existsByPhone(String phone);
    Optional<CustomerAccount> findByReferralCode(String referralCode);
    boolean existsByReferralCode(String referralCode);
}
