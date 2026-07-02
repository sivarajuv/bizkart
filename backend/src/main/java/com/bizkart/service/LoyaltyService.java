package com.bizkart.service;

import com.bizkart.model.CustomerAccount;
import com.bizkart.repository.CustomerAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class LoyaltyService {

    // 1 point per ₹10 spent; 1 point = ₹0.50 on redemption; max 20% of order redeemable
    private static final int    POINTS_PER_RUPEE_DIVISOR = 10;
    private static final double POINT_VALUE_RUPEES        = 0.50;
    private static final double MAX_REDEEM_FRACTION       = 0.20;

    private final CustomerAccountRepository customerRepo;

    public LoyaltyService(CustomerAccountRepository customerRepo) {
        this.customerRepo = customerRepo;
    }

    /** Points earned for a given order total */
    public int computeEarned(BigDecimal orderTotal) {
        return orderTotal.divide(BigDecimal.valueOf(POINTS_PER_RUPEE_DIVISOR), 0, RoundingMode.FLOOR)
                         .intValue();
    }

    /** Max points customer is allowed to redeem on an order */
    public int maxRedeemable(CustomerAccount customer, BigDecimal orderTotal) {
        double maxRupees = orderTotal.doubleValue() * MAX_REDEEM_FRACTION;
        int maxFromRupees = (int) (maxRupees / POINT_VALUE_RUPEES);
        return Math.min(customer.getLoyaltyPoints(), maxFromRupees);
    }

    /** Convert points to rupee discount */
    public BigDecimal pointsToRupees(int points) {
        return BigDecimal.valueOf(points * POINT_VALUE_RUPEES).setScale(2, RoundingMode.HALF_UP);
    }

    /** Add earned points after order completion */
    @Transactional
    public void addPoints(Long customerId, int points) {
        if (points <= 0) return;
        CustomerAccount ca = customerRepo.findById(customerId)
            .orElseThrow(() -> new RuntimeException("Customer not found"));
        ca.setLoyaltyPoints(ca.getLoyaltyPoints() + points);
        customerRepo.save(ca);
    }

    /** Deduct redeemed points when order placed */
    @Transactional
    public void deductPoints(Long customerId, int points) {
        if (points <= 0) return;
        CustomerAccount ca = customerRepo.findById(customerId)
            .orElseThrow(() -> new RuntimeException("Customer not found"));
        if (ca.getLoyaltyPoints() < points)
            throw new RuntimeException("Insufficient loyalty points");
        ca.setLoyaltyPoints(ca.getLoyaltyPoints() - points);
        customerRepo.save(ca);
    }

    public int getBalance(Long customerId) {
        return customerRepo.findById(customerId)
            .map(CustomerAccount::getLoyaltyPoints)
            .orElse(0);
    }
}
