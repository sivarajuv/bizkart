package com.bizkart.service;

import com.bizkart.model.CustomerAccount;
import com.bizkart.model.PushSubscription;
import com.bizkart.repository.CustomerAccountRepository;
import com.bizkart.repository.PushSubscriptionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PushNotificationService {

    private final PushSubscriptionRepository pushRepo;
    private final CustomerAccountRepository  customerRepo;

    public PushNotificationService(PushSubscriptionRepository pushRepo,
                                   CustomerAccountRepository customerRepo) {
        this.pushRepo     = pushRepo;
        this.customerRepo = customerRepo;
    }

    /** Save or update a push subscription for a customer */
    @Transactional
    public PushSubscription subscribe(Long customerId, SubscribeRequest req) {
        CustomerAccount customer = customerRepo.findById(customerId)
            .orElseThrow(() -> new RuntimeException("Customer not found"));

        // Upsert by endpoint
        PushSubscription sub = pushRepo.findByEndpoint(req.endpoint())
            .orElse(new PushSubscription());
        sub.setCustomerAccount(customer);
        sub.setEndpoint(req.endpoint());
        sub.setP256dh(req.p256dh());
        sub.setAuth(req.auth());
        return pushRepo.save(sub);
    }

    /** Remove subscription (called when customer revokes permission) */
    @Transactional
    public void unsubscribe(String endpoint) {
        pushRepo.deleteByEndpoint(endpoint);
    }

    /** Get all subscriptions for a customer (for server-side push sending) */
    public List<PushSubscription> getSubscriptions(Long customerId) {
        return pushRepo.findByCustomerAccountId(customerId);
    }

    public record SubscribeRequest(String endpoint, String p256dh, String auth) {}
}
