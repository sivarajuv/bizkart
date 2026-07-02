package com.bizkart.service;

import com.bizkart.model.User;
import com.bizkart.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserLoginIdentityService {

    public static final String PLATFORM_SCOPE = "platform";
    private static final String DELIMITER = "|";

    private final UserRepository userRepository;

    public UserLoginIdentityService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public record LoginIdentity(String shopCode, String username) {}

    public String buildPrincipal(User user) {
        String shopCode = user.getShop() != null ? user.getShop().getCode() : PLATFORM_SCOPE;
        return buildPrincipal(shopCode, user.getUsername());
    }

    public String buildPrincipal(String shopCode, String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        return normalizeShopCode(shopCode) + DELIMITER + username.trim();
    }

    public LoginIdentity parsePrincipal(String principal) {
        if (principal == null || principal.isBlank()) {
            throw new IllegalArgumentException("Authentication identity is missing");
        }

        int delimiterIndex = principal.indexOf(DELIMITER);
        if (delimiterIndex < 0) {
            return new LoginIdentity(PLATFORM_SCOPE, principal.trim());
        }

        String shopCode = principal.substring(0, delimiterIndex).trim();
        String username = principal.substring(delimiterIndex + DELIMITER.length()).trim();
        if (username.isBlank()) {
            throw new IllegalArgumentException("Authentication username is missing");
        }
        return new LoginIdentity(normalizeShopCode(shopCode), username);
    }

    public User requireUser(String principal) {
        LoginIdentity identity = parsePrincipal(principal);
        return findUser(identity.shopCode(), identity.username())
            .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public Optional<User> findUser(String shopCode, String username) {
        String normalizedUsername = username == null ? "" : username.trim();
        if (normalizedUsername.isBlank()) {
            return Optional.empty();
        }

        if (isPlatformScope(shopCode)) {
            return userRepository.findByUsernameAndShopIsNull(normalizedUsername);
        }
        return userRepository.findByUsernameAndShopCodeIgnoreCase(normalizedUsername, shopCode.trim());
    }

    public boolean usernameExists(String shopCode, Long shopId, String username) {
        String normalizedUsername = username == null ? "" : username.trim();
        if (normalizedUsername.isBlank()) {
            return false;
        }

        if (shopId == null || isPlatformScope(shopCode)) {
            return userRepository.existsByUsernameAndShopIsNull(normalizedUsername);
        }
        return userRepository.existsByUsernameAndShopId(normalizedUsername, shopId);
    }

    public String normalizeShopCode(String shopCode) {
        return (shopCode == null || shopCode.isBlank()) ? PLATFORM_SCOPE : shopCode.trim().toLowerCase();
    }

    public boolean isPlatformScope(String shopCode) {
        return PLATFORM_SCOPE.equalsIgnoreCase(normalizeShopCode(shopCode));
    }
}
