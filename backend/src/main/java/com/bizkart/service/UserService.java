package com.bizkart.service;

import com.bizkart.config.AppDefaults;
import com.bizkart.model.Shop;
import com.bizkart.model.User;
import com.bizkart.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private static final String USER_NOT_FOUND_MESSAGE = "User not found";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ShopService shopService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, ShopService shopService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.shopService = shopService;
    }

    public List<User> getAllUsers() {
        return userRepository.findAll().stream()
            .sorted((left, right) -> left.getUsername().compareToIgnoreCase(right.getUsername()))
            .toList();
    }

    public List<User> getUsersByShop(Long shopId) {
        return userRepository.findByShopId(shopId).stream()
            .sorted((left, right) -> left.getUsername().compareToIgnoreCase(right.getUsername()))
            .toList();
    }

    public User getUserById(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new RuntimeException(USER_NOT_FOUND_MESSAGE));
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException(USER_NOT_FOUND_MESSAGE));
    }

    public User updateUser(Long id, Map<String, String> updates) {
        User user = getUserById(id);
        if (updates.containsKey("fullName")) {
            user.setFullName(updates.get("fullName"));
        }
        if (updates.containsKey("email")) {
            user.setEmail(updates.get("email"));
        }
        if (updates.containsKey("role")) {
            user.setRole(User.Role.valueOf(updates.get("role")));
        }
        if (updates.containsKey("password") && updates.get("password") != null && !updates.get("password").isBlank()) {
            user.setPassword(passwordEncoder.encode(updates.get("password")));
        }
        if (updates.containsKey("shopId") && updates.get("shopId") != null && !updates.get("shopId").isBlank()) {
            Shop shop = shopService.ensureActiveShop(Long.valueOf(updates.get("shopId")));
            user.setShop(shop);
        }
        if (updates.containsKey("shopId") && (updates.get("shopId") == null || updates.get("shopId").isBlank()) && user.getRole() == User.Role.SUPER_ADMIN) {
            user.setShop(null);
        }
        return userRepository.save(user);
    }

    public User toggleUserStatus(Long id) {
        User user = getUserById(id);
        user.setEnabled(!user.isEnabled());
        return userRepository.save(user);
    }

    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }

    public void initDefaultUsers() {
        if (userRepository.count() == 0) {
            createDefaultSuperAdmin();
            log.info("Default super admin created with username {}", AppDefaults.DEFAULT_SUPER_ADMIN_USERNAME);
            return;
        }

        userRepository.findByEmail(AppDefaults.DEFAULT_SUPER_ADMIN_EMAIL).ifPresentOrElse(existingAdmin -> {
            if (existingAdmin.getRole() != User.Role.SUPER_ADMIN || existingAdmin.getShop() != null) {
                existingAdmin.setRole(User.Role.SUPER_ADMIN);
                existingAdmin.setShop(null);
                userRepository.save(existingAdmin);
                log.info("Existing default admin account was normalized to SUPER_ADMIN scope");
            }
        }, () -> {
            createDefaultSuperAdmin();
            log.info("Default super admin created with username {}", AppDefaults.DEFAULT_SUPER_ADMIN_USERNAME);
        });
    }

    private void createDefaultSuperAdmin() {
        User admin = new User();
        admin.setUsername(AppDefaults.DEFAULT_SUPER_ADMIN_USERNAME);
        admin.setEmail(AppDefaults.DEFAULT_SUPER_ADMIN_EMAIL);
        admin.setFullName(AppDefaults.DEFAULT_SUPER_ADMIN_NAME);
        admin.setPassword(passwordEncoder.encode(AppDefaults.DEFAULT_SUPER_ADMIN_PASSWORD));
        admin.setRole(User.Role.SUPER_ADMIN);
        admin.setShop(null);
        admin.setEnabled(true);
        userRepository.save(admin);
    }
}
