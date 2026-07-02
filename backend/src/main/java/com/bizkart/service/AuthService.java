package com.bizkart.service;

import com.bizkart.config.AppDefaults;
import com.bizkart.model.Shop;
import com.bizkart.model.User;
import com.bizkart.repository.UserRepository;
import com.bizkart.security.JwtUtils;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
public class AuthService {

    private static final String USERNAME_REQUIRED_MESSAGE = "Username is required";
    private static final String EMAIL_ALREADY_REGISTERED_MESSAGE = "Email already registered";
    private static final String SHOP_REQUIRED_MESSAGE = "Shop is required for this user";
    private static final String PLATFORM_USERNAME_TAKEN_MESSAGE = "Username already taken for platform users";
    private static final String SHOP_USERNAME_TAKEN_MESSAGE = "Username already taken in this shop";
    private static final String USER_REGISTERED_MESSAGE = "User registered successfully";
    private static final String ACCOUNT_DISABLED_MESSAGE = "Account is disabled";
    private static final String INVALID_LOGIN_MESSAGE = "Invalid username, password, or business code";
    private static final String INVALID_REFRESH_TOKEN_MESSAGE = "Invalid or expired refresh token";
    private static final String CURRENT_PASSWORD_REQUIRED_MESSAGE = "Current password is required";
    private static final String NEW_PASSWORD_REQUIRED_MESSAGE = "New password is required";
    private static final String PASSWORD_TOO_SHORT_TEMPLATE = "New password must be at least %d characters long";
    private static final String CURRENT_PASSWORD_INCORRECT_MESSAGE = "Current password is incorrect";
    private static final String PASSWORD_MUST_CHANGE_MESSAGE = "New password must be different from the current password";
    private static final String PASSWORD_CHANGED_MESSAGE = "Password changed successfully";

    private final UserRepository userRepository;
    private final ShopService shopService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final UserLoginIdentityService userLoginIdentityService;

    public AuthService(
        UserRepository userRepository,
        ShopService shopService,
        PasswordEncoder passwordEncoder,
        JwtUtils jwtUtils,
        AuthenticationManager authenticationManager,
        UserDetailsService userDetailsService,
        UserLoginIdentityService userLoginIdentityService
    ) {
        this.userRepository = userRepository;
        this.shopService = shopService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.userLoginIdentityService = userLoginIdentityService;
    }

    public record LoginRequest(String shopCode, String username, String password) {}
    public record RegisterRequest(String username, String email, String fullName, String password, User.Role role, Long shopId) {}

    public Map<String, Object> login(LoginRequest request) {
        if (request.username() == null || request.username().isBlank()) {
            throw new RuntimeException(USERNAME_REQUIRED_MESSAGE);
        }

        String principal = userLoginIdentityService.buildPrincipal(request.shopCode(), request.username());
        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(principal, request.password())
            );
        } catch (DisabledException e) {
            throw new RuntimeException(ACCOUNT_DISABLED_MESSAGE);
        } catch (BadCredentialsException e) {
            throw new RuntimeException(INVALID_LOGIN_MESSAGE);
        }

        User user = userLoginIdentityService.requireUser(principal);

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        UserDetails userDetails = userDetailsService.loadUserByUsername(principal);
        String token = jwtUtils.generateToken(userDetails, user);
        String refreshToken = jwtUtils.generateRefreshToken(userDetails);

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("refreshToken", refreshToken);
        response.put("expiresIn", jwtUtils.getExpirationMs());
        response.put("user", buildUserPayload(user));
        return response;
    }

    public Map<String, Object> register(RegisterRequest request) {
        if (request.username() == null || request.username().isBlank()) {
            throw new RuntimeException(USERNAME_REQUIRED_MESSAGE);
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new RuntimeException(EMAIL_ALREADY_REGISTERED_MESSAGE);
        }

        User.Role role = request.role() != null ? request.role() : User.Role.CASHIER;
        Shop shop = null;
        if (role != User.Role.SUPER_ADMIN || request.shopId() != null) {
            if (request.shopId() == null) {
                throw new RuntimeException(SHOP_REQUIRED_MESSAGE);
            }
            shop = shopService.ensureActiveShop(request.shopId());
        }

        String shopCode = shop != null ? shop.getCode() : UserLoginIdentityService.PLATFORM_SCOPE;
        if (userLoginIdentityService.usernameExists(shopCode, shop != null ? shop.getId() : null, request.username())) {
            throw new RuntimeException(shop == null
                ? PLATFORM_USERNAME_TAKEN_MESSAGE
                : SHOP_USERNAME_TAKEN_MESSAGE);
        }

        User user = new User();
        user.setUsername(request.username().trim());
        user.setEmail(request.email());
        user.setFullName(request.fullName());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(role);
        user.setShop(shop);
        user.setEnabled(true);
        userRepository.save(user);

        return Map.of(
            "message", USER_REGISTERED_MESSAGE,
            "user", buildUserPayload(user)
        );
    }

    public Map<String, Object> refreshToken(String refreshToken) {
        try {
            String principal = jwtUtils.extractUsername(refreshToken);
            UserDetails userDetails = userDetailsService.loadUserByUsername(principal);
            if (jwtUtils.isTokenValid(refreshToken, userDetails)) {
                User user = userLoginIdentityService.requireUser(principal);
                String newToken = jwtUtils.generateToken(userDetails, user);
                return Map.of("token", newToken, "expiresIn", jwtUtils.getExpirationMs());
            }
        } catch (Exception ignored) {
        }
        throw new RuntimeException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    public Map<String, Object> changePassword(String principal, String currentPassword, String newPassword) {
        User user = userLoginIdentityService.requireUser(principal);

        if (currentPassword == null || currentPassword.isBlank()) {
            throw new RuntimeException(CURRENT_PASSWORD_REQUIRED_MESSAGE);
        }

        if (newPassword == null || newPassword.isBlank()) {
            throw new RuntimeException(NEW_PASSWORD_REQUIRED_MESSAGE);
        }

        if (newPassword.length() < AppDefaults.MIN_PASSWORD_LENGTH) {
            throw new RuntimeException(PASSWORD_TOO_SHORT_TEMPLATE.formatted(AppDefaults.MIN_PASSWORD_LENGTH));
        }

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new RuntimeException(CURRENT_PASSWORD_INCORRECT_MESSAGE);
        }

        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new RuntimeException(PASSWORD_MUST_CHANGE_MESSAGE);
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        return Map.of("message", PASSWORD_CHANGED_MESSAGE);
    }

    public Map<String, Object> buildUserPayload(User user) {
        Map<String, Object> userPayload = new HashMap<>();
        userPayload.put("id", user.getId());
        userPayload.put("username", user.getUsername());
        userPayload.put("loginShopCode", user.getShop() != null ? user.getShop().getCode() : UserLoginIdentityService.PLATFORM_SCOPE);
        userPayload.put("email", user.getEmail());
        userPayload.put("fullName", user.getFullName());
        userPayload.put("role", user.getRole().name());
        if (user.getShop() == null) {
            userPayload.put("shop", null);
        } else {
            Map<String, Object> shopPayload = new HashMap<>();
            shopPayload.put("id", user.getShop().getId());
            shopPayload.put("code", user.getShop().getCode());
            shopPayload.put("name", user.getShop().getName());
            shopPayload.put("defaultLanguage", user.getShop().getDefaultLanguage());
            shopPayload.put("businessType", user.getShop().getBusinessType() == null || user.getShop().getBusinessType().isBlank() ? AppDefaults.DEFAULT_BUSINESS_TYPE : user.getShop().getBusinessType());
            userPayload.put("shop", shopPayload);
        }
        return userPayload;
    }
}
