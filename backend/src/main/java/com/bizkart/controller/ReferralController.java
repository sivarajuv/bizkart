package com.bizkart.controller;

import com.bizkart.security.JwtUtils;
import com.bizkart.service.ReferralService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/portal/referral")
public class ReferralController {

    private final ReferralService referralService;
    private final JwtUtils jwtUtils;

    public ReferralController(ReferralService referralService, JwtUtils jwtUtils) {
        this.referralService = referralService;
        this.jwtUtils        = jwtUtils;
    }

    @GetMapping
    public ResponseEntity<?> getReferralInfo(@RequestHeader("Authorization") String auth) {
        try {
            Long customerId = customerId(auth);
            return ResponseEntity.ok(referralService.getReferralInfo(customerId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    private Long customerId(String auth) {
        return jwtUtils.getCustomerIdFromToken(auth.replace("Bearer ", ""));
    }
}
