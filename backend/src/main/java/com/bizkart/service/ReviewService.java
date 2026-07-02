package com.bizkart.service;

import com.bizkart.model.*;
import com.bizkart.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class ReviewService {

    private final ReviewRepository reviewRepo;
    private final OnlineOrderRepository orderRepo;
    private final ProductRepository productRepo;
    private final ShopRepository shopRepo;
    private final CustomerAccountRepository customerRepo;

    public ReviewService(ReviewRepository reviewRepo, OnlineOrderRepository orderRepo,
                         ProductRepository productRepo, ShopRepository shopRepo,
                         CustomerAccountRepository customerRepo) {
        this.reviewRepo   = reviewRepo;
        this.orderRepo    = orderRepo;
        this.productRepo  = productRepo;
        this.shopRepo     = shopRepo;
        this.customerRepo = customerRepo;
    }

    /** Submit a review for a product or shop after delivery */
    @Transactional
    public Review submit(Long customerId, SubmitReviewRequest req) {
        OnlineOrder order = orderRepo.findById(req.orderId())
            .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!order.getCustomerAccount().getId().equals(customerId))
            throw new RuntimeException("Access denied");

        if (!List.of(OnlineOrder.OrderStatus.DELIVERED, OnlineOrder.OrderStatus.PICKED_UP)
                 .contains(order.getStatus()))
            throw new RuntimeException("You can only review completed orders");

        // Check duplicate
        if (req.productId() != null) {
            if (reviewRepo.findByOnlineOrderIdAndProductId(req.orderId(), req.productId()).isPresent())
                throw new RuntimeException("Already reviewed this product for the order");
        } else {
            if (reviewRepo.findByOnlineOrderIdAndProductIdIsNull(req.orderId()).isPresent())
                throw new RuntimeException("Already reviewed this shop for the order");
        }

        CustomerAccount customer = customerRepo.findById(customerId)
            .orElseThrow(() -> new RuntimeException("Customer not found"));

        Review r = new Review();
        r.setCustomerAccount(customer);
        r.setOnlineOrder(order);
        r.setShop(order.getShop());
        if (req.productId() != null)
            r.setProduct(productRepo.findById(req.productId())
                .orElseThrow(() -> new RuntimeException("Product not found")));
        r.setRating((short) req.rating());
        r.setComment(req.comment());
        return reviewRepo.save(r);
    }

    public List<Review> getShopReviews(Long shopId) {
        return reviewRepo.findByShopIdAndProductIdIsNullOrderByCreatedAtDesc(shopId);
    }

    public List<Review> getProductReviews(Long productId) {
        return reviewRepo.findByProductIdOrderByCreatedAtDesc(productId);
    }

    public Map<String, Object> getShopRatingSummary(Long shopId) {
        double avg = reviewRepo.avgShopRating(shopId);
        long count = reviewRepo.findByShopIdAndProductIdIsNullOrderByCreatedAtDesc(shopId).size();
        return Map.of("average", Math.round(avg * 10.0) / 10.0, "count", count);
    }

    public Map<String, Object> getProductRatingSummary(Long productId) {
        double avg = reviewRepo.avgProductRating(productId);
        long count = reviewRepo.findByProductIdOrderByCreatedAtDesc(productId).size();
        return Map.of("average", Math.round(avg * 10.0) / 10.0, "count", count);
    }

    /** Check if the customer has already reviewed the order (for UI prompt) */
    public boolean hasReviewed(Long orderId) {
        return reviewRepo.countByOrderId(orderId) > 0;
    }

    public record SubmitReviewRequest(Long orderId, Long productId, int rating, String comment) {}
}
