package com.bizkart.service;

import com.bizkart.model.Customer;
import com.bizkart.model.LedgerEntry;
import com.bizkart.model.Order;
import com.bizkart.model.Shop;
import com.bizkart.model.User;
import com.bizkart.repository.CustomerRepository;
import com.bizkart.repository.LedgerEntryRepository;
import com.bizkart.repository.OrderRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final OrderRepository orderRepository;
    private final CurrentUserService currentUserService;

    public CustomerService(
        CustomerRepository customerRepository,
        LedgerEntryRepository ledgerEntryRepository,
        OrderRepository orderRepository,
        CurrentUserService currentUserService
    ) {
        this.customerRepository = customerRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.orderRepository = orderRepository;
        this.currentUserService = currentUserService;
    }

    public record CustomerPaymentRequest(
        BigDecimal amount,
        Order.PaymentMethod paymentMethod,
        String note
    ) {}

    public List<Customer> getCustomers(Authentication authentication) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            return customerRepository.findAllByOrderByOutstandingBalanceDescNameAsc();
        }
        return customerRepository.findByShopIdOrderByOutstandingBalanceDescNameAsc(currentUserService.requireShop(user).getId());
    }

    public List<LedgerEntry> getLedger(Authentication authentication, Long customerId) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            if (customerId == null) {
                return ledgerEntryRepository.findAllByOrderByCreatedAtDesc();
            }
            Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Customer not found"));
            return ledgerEntryRepository.findByShopIdAndCustomerIdOrderByCreatedAtDesc(customer.getShop().getId(), customerId);
        }
        Shop shop = currentUserService.requireShop(user);
        if (customerId == null) {
            return ledgerEntryRepository.findByShopIdOrderByCreatedAtDesc(shop.getId());
        }
        ensureCustomer(shop, customerId);
        return ledgerEntryRepository.findByShopIdAndCustomerIdOrderByCreatedAtDesc(shop.getId(), customerId);
    }

    public List<Order> getCustomerOrders(Authentication authentication, Long customerId) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Customer not found"));
            return orderRepository.findByShopIdAndCustomerIdOrderByCreatedAtDesc(customer.getShop().getId(), customerId);
        }
        Shop shop = currentUserService.requireShop(user);
        ensureCustomer(shop, customerId);
        return orderRepository.findByShopIdAndCustomerIdOrderByCreatedAtDesc(shop.getId(), customerId);
    }

    @Transactional
    public LedgerEntry recordPayment(Authentication authentication, Long customerId, CustomerPaymentRequest request) {
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Payment amount must be greater than zero");
        }

        User currentUser = currentUserService.requireUser(authentication);
        Customer customer = currentUserService.isSuperAdmin(currentUser)
            ? customerRepository.findById(customerId).orElseThrow(() -> new RuntimeException("Customer not found"))
            : ensureCustomer(currentUserService.requireShop(currentUser), customerId);
        Shop shop = customer.getShop();

        if (customer.getOutstandingBalance().compareTo(request.amount()) < 0) {
            throw new RuntimeException("Payment exceeds customer outstanding balance");
        }

        BigDecimal newBalance = customer.getOutstandingBalance().subtract(request.amount());
        customer.setOutstandingBalance(newBalance);
        customer.setTotalCreditRecovered(customer.getTotalCreditRecovered().add(request.amount()));
        customer.setLastTransactionAt(LocalDateTime.now());
        customerRepository.save(customer);

        LedgerEntry entry = new LedgerEntry();
        entry.setShop(shop);
        entry.setCustomer(customer);
        entry.setCreatedBy(currentUser);
        entry.setEntryType(LedgerEntry.EntryType.PAYMENT_COLLECTION);
        entry.setDirection(LedgerEntry.Direction.CREDIT);
        entry.setAmount(request.amount());
        entry.setBalanceAfter(newBalance);
        entry.setNote(buildPaymentNote(request));
        return ledgerEntryRepository.save(entry);
    }

    @Transactional
    public Customer findOrCreateCustomer(Shop shop, String customerName, String customerPhone) {
        String normalizedName = customerName == null ? "" : customerName.trim();
        String normalizedPhone = normalizePhone(customerPhone);

        if (normalizedPhone != null && !normalizedPhone.isBlank()) {
            return customerRepository.findByShopIdAndPhone(shop.getId(), normalizedPhone)
                .map(existing -> updateCustomerIdentity(existing, normalizedName, normalizedPhone))
                .orElseGet(() -> createCustomer(shop, normalizedName, normalizedPhone));
        }

        List<Customer> matches = customerRepository.findByShopIdAndNameContainingIgnoreCaseOrderByNameAsc(shop.getId(), normalizedName);
        for (Customer match : matches) {
            if (match.getName().equalsIgnoreCase(normalizedName)) {
                return updateCustomerIdentity(match, normalizedName, normalizedPhone);
            }
        }

        return createCustomer(shop, normalizedName, normalizedPhone);
    }

    @Transactional
    public void recordCreditSale(Customer customer, Order order, User currentUser, BigDecimal dueAmount) {
        BigDecimal newBalance = customer.getOutstandingBalance().add(dueAmount);
        customer.setOutstandingBalance(newBalance);
        customer.setTotalCreditExtended(customer.getTotalCreditExtended().add(dueAmount));
        customer.setLastTransactionAt(LocalDateTime.now());
        customerRepository.save(customer);

        LedgerEntry entry = new LedgerEntry();
        entry.setShop(customer.getShop());
        entry.setCustomer(customer);
        entry.setOrder(order);
        entry.setCreatedBy(currentUser);
        entry.setEntryType(LedgerEntry.EntryType.CREDIT_SALE);
        entry.setDirection(LedgerEntry.Direction.DEBIT);
        entry.setAmount(dueAmount);
        entry.setBalanceAfter(newBalance);
        entry.setNote("Credit sale for order " + order.getOrderNumber());
        ledgerEntryRepository.save(entry);
    }

    public Map<String, Object> getCustomerSummary(Authentication authentication) {
        List<Customer> customers = getCustomers(authentication);
        BigDecimal outstanding = customers.stream()
            .map(Customer::getOutstandingBalance)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal extended = customers.stream()
            .map(Customer::getTotalCreditExtended)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal recovered = customers.stream()
            .map(Customer::getTotalCreditRecovered)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> summary = new HashMap<>();
        summary.put("customerCount", customers.size());
        summary.put("customersWithOutstanding", customers.stream().filter(c -> c.getOutstandingBalance().compareTo(BigDecimal.ZERO) > 0).count());
        summary.put("totalOutstanding", outstanding);
        summary.put("totalCreditExtended", extended);
        summary.put("totalCreditRecovered", recovered);
        return summary;
    }

    private String buildPaymentNote(CustomerPaymentRequest request) {
        String method = request.paymentMethod() == null ? "PAYMENT" : request.paymentMethod().name();
        if (request.note() == null || request.note().isBlank()) {
            return "Collection via " + method;
        }
        return method + ": " + request.note().trim();
    }

    private Customer ensureCustomer(Shop shop, Long customerId) {
        return customerRepository.findByIdAndShopId(customerId, shop.getId())
            .orElseThrow(() -> new RuntimeException("Customer not found"));
    }

    private Customer updateCustomerIdentity(Customer existing, String name, String phone) {
        if (name != null && !name.isBlank()) {
            existing.setName(name);
        }
        if (phone != null && !phone.isBlank()) {
            existing.setPhone(phone);
        }
        return customerRepository.save(existing);
    }

    private Customer createCustomer(Shop shop, String name, String phone) {
        if (name == null || name.isBlank()) {
            throw new RuntimeException("Customer name is required");
        }
        Customer customer = new Customer();
        customer.setShop(shop);
        customer.setName(name);
        customer.setPhone(phone);
        customer.setLastTransactionAt(LocalDateTime.now());
        return customerRepository.save(customer);
    }

    private String normalizePhone(String value) {
        if (value == null) {
            return null;
        }
        String digitsOnly = value.replaceAll("[^0-9+]", "").trim();
        return digitsOnly.isBlank() ? null : digitsOnly;
    }
}
