package com.bizkart.repository;

import com.bizkart.model.Referral;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ReferralRepository extends JpaRepository<Referral, Long> {
    List<Referral> findByReferrerIdOrderByCreatedAtDesc(Long referrerId);
    Optional<Referral> findByReferredId(Long referredId);
}
