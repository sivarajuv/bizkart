package com.bizkart.service;

import com.bizkart.model.*;
import com.bizkart.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ReferralService {

    private static final int REFERRER_BONUS_POINTS = 50;  // points given to referrer on first order
    private static final int REFERRED_BONUS_POINTS = 30;  // points given to new customer on first order

    private final CustomerAccountRepository customerRepo;
    private final ReferralRepository referralRepo;

    public ReferralService(CustomerAccountRepository customerRepo, ReferralRepository referralRepo) {
        this.customerRepo  = customerRepo;
        this.referralRepo  = referralRepo;
    }

    /** Generate/return referral code for a customer */
    @Transactional
    public String getOrCreateReferralCode(Long customerId) {
        CustomerAccount customer = customerRepo.findById(customerId)
            .orElseThrow(() -> new RuntimeException("Customer not found"));
        if (customer.getReferralCode() != null) {
            return customer.getReferralCode();
        }
        // Generate unique 8-char code: BK + 6 alphanumeric
        String code;
        do {
            code = "BK" + generateSuffix(6);
        } while (customerRepo.existsByReferralCode(code));
        customer.setReferralCode(code);
        customerRepo.save(customer);
        return code;
    }

    /** Called during registration if referral code was provided */
    @Transactional
    public void applyReferral(Long newCustomerId, String referralCode) {
        if (referralCode == null || referralCode.isBlank()) return;
        Optional<CustomerAccount> referrerOpt = customerRepo.findByReferralCode(referralCode);
        if (referrerOpt.isEmpty()) return;
        CustomerAccount referrer = referrerOpt.get();
        if (referrer.getId().equals(newCustomerId)) return; // can't refer yourself

        // Check not already referred
        CustomerAccount newCustomer = customerRepo.findById(newCustomerId)
            .orElseThrow(() -> new RuntimeException("Customer not found"));
        if (referralRepo.findByReferredId(newCustomerId).isPresent()) return;

        Referral ref = new Referral();
        ref.setReferrer(referrer);
        ref.setReferred(newCustomer);
        referralRepo.save(ref);
    }

    /** Called after a referred customer places their first order – grant bonuses */
    @Transactional
    public void completeReferralIfPending(Long customerId) {
        Optional<Referral> refOpt = referralRepo.findByReferredId(customerId);
        if (refOpt.isEmpty() || refOpt.get().isCompleted()) return;
        Referral ref = refOpt.get();

        // Add bonus points to both parties
        CustomerAccount referrer = ref.getReferrer();
        referrer.setLoyaltyPoints(referrer.getLoyaltyPoints() + REFERRER_BONUS_POINTS);
        customerRepo.save(referrer);

        CustomerAccount referred = ref.getReferred();
        referred.setLoyaltyPoints(referred.getLoyaltyPoints() + REFERRED_BONUS_POINTS);
        customerRepo.save(referred);

        ref.setCompleted(true);
        ref.setCompletedAt(LocalDateTime.now());
        referralRepo.save(ref);
    }

    public List<Referral> getReferralsByCustomer(Long customerId) {
        return referralRepo.findByReferrerIdOrderByCreatedAtDesc(customerId);
    }

    public Map<String, Object> getReferralInfo(Long customerId) {
        String code = getOrCreateReferralCode(customerId);
        List<Referral> referrals = getReferralsByCustomer(customerId);
        long completed = referrals.stream().filter(Referral::isCompleted).count();
        return Map.of(
            "referralCode", code,
            "shareLink",    "https://bizkart.app/join?ref=" + code,
            "totalReferrals", referrals.size(),
            "completedReferrals", completed,
            "referrerBonus", REFERRER_BONUS_POINTS,
            "referredBonus", REFERRED_BONUS_POINTS,
            "referrals", referrals
        );
    }

    private String generateSuffix(int length) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        Random rnd = new Random();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
