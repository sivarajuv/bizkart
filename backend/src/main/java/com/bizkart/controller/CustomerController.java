package com.bizkart.controller;

import com.bizkart.model.Customer;
import com.bizkart.model.LedgerEntry;
import com.bizkart.model.Order;
import com.bizkart.service.CustomerService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    public List<Customer> getCustomers(Authentication authentication) {
        return customerService.getCustomers(authentication);
    }

    @GetMapping("/summary")
    public Map<String, Object> getSummary(Authentication authentication) {
        return customerService.getCustomerSummary(authentication);
    }

    @GetMapping("/ledger")
    public List<LedgerEntry> getLedger(Authentication authentication, @RequestParam(required = false) Long customerId) {
        return customerService.getLedger(authentication, customerId);
    }

    @GetMapping("/{customerId}/orders")
    public List<Order> getCustomerOrders(Authentication authentication, @PathVariable Long customerId) {
        return customerService.getCustomerOrders(authentication, customerId);
    }

    @PostMapping("/{customerId}/payments")
    public ResponseEntity<?> recordPayment(Authentication authentication, @PathVariable Long customerId, @RequestBody CustomerService.CustomerPaymentRequest request) {
        try {
            return ResponseEntity.ok(customerService.recordPayment(authentication, customerId, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
