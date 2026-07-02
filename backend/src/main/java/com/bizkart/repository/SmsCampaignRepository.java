package com.bizkart.repository;

import com.bizkart.model.SmsCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SmsCampaignRepository extends JpaRepository<SmsCampaign, Long> {
    List<SmsCampaign> findAllByOrderByCreatedAtDesc();
}
