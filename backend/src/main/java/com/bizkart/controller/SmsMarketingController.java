package com.bizkart.controller;

import com.bizkart.model.SmsCampaign;
import com.bizkart.repository.CustomerAccountRepository;
import com.bizkart.repository.OnlineOrderRepository;
import com.bizkart.repository.SmsCampaignRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/sms-campaigns")
public class SmsMarketingController {

    private final SmsCampaignRepository campaignRepo;
    private final CustomerAccountRepository customerRepo;
    private final OnlineOrderRepository orderRepo;

    public SmsMarketingController(
        SmsCampaignRepository campaignRepo,
        CustomerAccountRepository customerRepo,
        OnlineOrderRepository orderRepo
    ) {
        this.campaignRepo = campaignRepo;
        this.customerRepo = customerRepo;
        this.orderRepo    = orderRepo;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(campaignRepo.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody SmsCampaign campaign) {
        campaign.setId(null);
        campaign.setStatus(SmsCampaign.CampaignStatus.DRAFT);
        campaign.setRecipientCount(countRecipients(campaign.getTargetType()));
        return ResponseEntity.ok(campaignRepo.save(campaign));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody SmsCampaign updated) {
        SmsCampaign existing = campaignRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Campaign not found"));
        if (existing.getStatus() == SmsCampaign.CampaignStatus.SENT) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot edit a sent campaign"));
        }
        existing.setTitle(updated.getTitle());
        existing.setMessage(updated.getMessage());
        existing.setTargetType(updated.getTargetType());
        existing.setScheduledAt(updated.getScheduledAt());
        existing.setRecipientCount(countRecipients(updated.getTargetType()));
        return ResponseEntity.ok(campaignRepo.save(existing));
    }

    /** Simulate sending: mark as SENT with current timestamp */
    @PostMapping("/{id}/send")
    public ResponseEntity<?> send(@PathVariable Long id) {
        SmsCampaign campaign = campaignRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Campaign not found"));
        if (campaign.getStatus() == SmsCampaign.CampaignStatus.SENT) {
            return ResponseEntity.badRequest().body(Map.of("error", "Already sent"));
        }
        campaign.setStatus(SmsCampaign.CampaignStatus.SENT);
        campaign.setSentAt(LocalDateTime.now());
        campaign.setRecipientCount(countRecipients(campaign.getTargetType()));
        // In production: integrate with SMS provider (Twilio, MSG91, etc.)
        return ResponseEntity.ok(campaignRepo.save(campaign));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        campaignRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    private int countRecipients(SmsCampaign.TargetType type) {
        if (type == null || type == SmsCampaign.TargetType.ALL) {
            return (int) customerRepo.count();
        }
        // Simplified estimation (production: use proper queries)
        long total = customerRepo.count();
        return switch (type) {
            case ACTIVE    -> (int)(total * 0.6);
            case INACTIVE  -> (int)(total * 0.4);
            case HIGH_VALUE -> (int)(total * 0.2);
            default        -> (int) total;
        };
    }
}
