package com.bizkart.controller;

import com.bizkart.security.JwtUtils;
import com.bizkart.service.ReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/portal/reviews")
public class ReviewController {

    private final ReviewService reviewService;
    private final JwtUtils jwtUtils;

    public ReviewController(ReviewService reviewService, JwtUtils jwtUtils) {
        this.reviewService = reviewService;
        this.jwtUtils      = jwtUtils;
    }

    /** Submit a review (auth required) */
    @PostMapping
    public ResponseEntity<?> submit(
        @RequestHeader("Authorization") String authHeader,
        @RequestBody ReviewService.SubmitReviewRequest req
    ) {
        try {
            Long customerId = extractCustomerId(authHeader);
            return ResponseEntity.ok(reviewService.submit(customerId, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Public – shop reviews */
    @GetMapping("/shop/{shopId}")
    public ResponseEntity<?> shopReviews(@PathVariable Long shopId) {
        return ResponseEntity.ok(reviewService.getShopReviews(shopId));
    }

    /** Public – product reviews */
    @GetMapping("/product/{productId}")
    public ResponseEntity<?> productReviews(@PathVariable Long productId) {
        return ResponseEntity.ok(reviewService.getProductReviews(productId));
    }

    /** Public – shop rating summary */
    @GetMapping("/shop/{shopId}/summary")
    public ResponseEntity<?> shopSummary(@PathVariable Long shopId) {
        return ResponseEntity.ok(reviewService.getShopRatingSummary(shopId));
    }

    /** Public – product rating summary */
    @GetMapping("/product/{productId}/summary")
    public ResponseEntity<?> productSummary(@PathVariable Long productId) {
        return ResponseEntity.ok(reviewService.getProductRatingSummary(productId));
    }

    /** Auth – check if order has been reviewed */
    @GetMapping("/order/{orderId}/reviewed")
    public ResponseEntity<?> hasReviewed(@PathVariable Long orderId) {
        return ResponseEntity.ok(Map.of("reviewed", reviewService.hasReviewed(orderId)));
    }

    private Long extractCustomerId(String authHeader) {
        return jwtUtils.getCustomerIdFromToken(authHeader.replace("Bearer ", ""));
    }
}
