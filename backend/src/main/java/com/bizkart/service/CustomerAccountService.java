package com.bizkart.service;

import com.bizkart.model.CustomerAccount;
import com.bizkart.repository.CustomerAccountRepository;
import com.bizkart.security.JwtUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;

@Service
public class CustomerAccountService {

    private final CustomerAccountRepository repo;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final JwtUtils jwtUtils;

    public CustomerAccountService(CustomerAccountRepository repo, JwtUtils jwtUtils) {
        this.repo     = repo;
        this.jwtUtils = jwtUtils;
    }

    public record RegisterRequest(String name, String phone, String email, String password) {}

    public record LoginRequest(String phone, String password) {}

    public record ResetPasswordRequest(String phone, String newPassword) {}

    @Transactional
    public Map<String, Object> register(RegisterRequest req) {
        if (req.name() == null || req.name().isBlank())
            throw new RuntimeException("Name is required");
        if (req.phone() == null || req.phone().isBlank())
            throw new RuntimeException("Phone is required");
        if (req.password() == null || req.password().length() < 6)
            throw new RuntimeException("Password must be at least 6 characters");
        if (repo.existsByPhone(req.phone()))
            throw new RuntimeException("Phone number already registered");

        CustomerAccount account = new CustomerAccount();
        account.setName(req.name().trim());
        account.setPhone(req.phone().trim());
        account.setEmail(req.email() != null ? req.email().trim() : null);
        account.setPasswordHash(encoder.encode(req.password()));
        account.setEnabled(true);
        account = repo.save(account);

        String token = jwtUtils.generateCustomerToken(account.getId(), account.getPhone());
        return Map.of("token", token, "customer", account);
    }

    public Map<String, Object> login(LoginRequest req) {
        CustomerAccount account = repo.findByPhone(req.phone())
            .orElseThrow(() -> new RuntimeException("No account found for this phone number"));
        if (!account.isEnabled())
            throw new RuntimeException("Account is disabled");
        if (!encoder.matches(req.password(), account.getPasswordHash()))
            throw new RuntimeException("Incorrect password");

        String token = jwtUtils.generateCustomerToken(account.getId(), account.getPhone());
        return Map.of("token", token, "customer", account);
    }

    public CustomerAccount getById(Long id) {
        return repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Customer account not found: " + id));
    }

    // Phone-verified reset — no OTP/email delivery is wired up yet, so identity is
    // confirmed by knowledge of the registered phone number (same identifier used to
    // log in). This lets a customer who forgot their password get back in immediately
    // without needing SMS/email infrastructure. Revisit with OTP verification once an
    // SMS/WhatsApp/email provider is configured.
    @Transactional
    public Map<String, Object> resetPassword(ResetPasswordRequest req) {
        if (req.phone() == null || req.phone().isBlank())
            throw new RuntimeException("Phone number is required");
        if (req.newPassword() == null || req.newPassword().length() < 6)
            throw new RuntimeException("Password must be at least 6 characters");

        CustomerAccount account = repo.findByPhone(req.phone().trim())
            .orElseThrow(() -> new RuntimeException("No account found for this phone number"));
        if (!account.isEnabled())
            throw new RuntimeException("Account is disabled");

        account.setPasswordHash(encoder.encode(req.newPassword()));
        repo.save(account);

        String token = jwtUtils.generateCustomerToken(account.getId(), account.getPhone());
        return Map.of("token", token, "customer", account);
    }
}
