package com.bizkart.service;

import com.bizkart.model.Shop;
import com.bizkart.model.User;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {

    private final UserLoginIdentityService userLoginIdentityService;

    public CurrentUserService(UserLoginIdentityService userLoginIdentityService) {
        this.userLoginIdentityService = userLoginIdentityService;
    }

    public User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Authentication required");
        }
        return userLoginIdentityService.requireUser(authentication.getName());
    }

    public boolean isAdmin(User user) {
        return user.getRole() == User.Role.ADMIN;
    }

    public boolean isSuperAdmin(User user) {
        return user.getRole() == User.Role.SUPER_ADMIN;
    }

    public boolean canManageShop(User user) {
        return user.getRole() == User.Role.SUPER_ADMIN || user.getRole() == User.Role.ADMIN || user.getRole() == User.Role.MANAGER;
    }

    public boolean canManageUsers(User user) {
        return user.getRole() == User.Role.SUPER_ADMIN || user.getRole() == User.Role.ADMIN;
    }

    public boolean canViewBusinessInsights(User user) {
        return user.getRole() == User.Role.ADMIN || user.getRole() == User.Role.MANAGER;
    }

    public boolean hasFullShopAccess(User user) {
        return user.getRole() == User.Role.SUPER_ADMIN || user.getRole() == User.Role.ADMIN || user.getRole() == User.Role.MANAGER;
    }

    public Shop requireShop(User user) {
        if (user.getShop() == null) {
            throw new RuntimeException("No shop assigned to user");
        }
        return user.getShop();
    }
}
