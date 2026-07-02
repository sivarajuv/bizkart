package com.bizkart.controller;

import com.bizkart.model.User;
import com.bizkart.service.AuthService;
import com.bizkart.service.CurrentUserService;
import com.bizkart.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final AuthService authService;
    private final CurrentUserService currentUserService;

    public UserController(UserService userService, AuthService authService, CurrentUserService currentUserService) {
        this.userService = userService;
        this.authService = authService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public ResponseEntity<?> getAllUsers(Authentication authentication) {
        User currentUser = currentUserService.requireUser(authentication);
        if (!currentUserService.canManageUsers(currentUser)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not allowed"));
        }
        List<User> users = currentUserService.isSuperAdmin(currentUser)
            ? userService.getAllUsers()
            : userService.getUsersByShop(currentUserService.requireShop(currentUser).getId());
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUser(Authentication authentication, @PathVariable Long id) {
        User currentUser = currentUserService.requireUser(authentication);
        if (!currentUserService.canManageUsers(currentUser)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not allowed"));
        }

        User targetUser = userService.getUserById(id);
        if (!currentUserService.isSuperAdmin(currentUser)
            && (targetUser.getShop() == null || !targetUser.getShop().getId().equals(currentUserService.requireShop(currentUser).getId()))) {
            return ResponseEntity.status(403).body(Map.of("error", "Cannot view another shop user"));
        }
        return ResponseEntity.ok(targetUser);
    }

    @PostMapping
    public ResponseEntity<?> createUser(Authentication authentication, @RequestBody AuthService.RegisterRequest request) {
        User currentUser = currentUserService.requireUser(authentication);
        if (!currentUserService.canManageUsers(currentUser)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not allowed"));
        }

        try {
            AuthService.RegisterRequest scopedRequest = request;
            if (!currentUserService.isSuperAdmin(currentUser)) {
                if (request.role() == User.Role.SUPER_ADMIN) {
                    return ResponseEntity.status(403).body(Map.of("error", "Cannot create super admin"));
                }
                Long shopId = currentUserService.requireShop(currentUser).getId();
                scopedRequest = new AuthService.RegisterRequest(
                    request.username(),
                    request.email(),
                    request.fullName(),
                    request.password(),
                    request.role(),
                    shopId
                );
            }
            return ResponseEntity.ok(authService.register(scopedRequest));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(Authentication authentication, @PathVariable Long id, @RequestBody Map<String, String> updates) {
        User currentUser = currentUserService.requireUser(authentication);
        if (!currentUserService.canManageUsers(currentUser)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not allowed"));
        }

        User targetUser = userService.getUserById(id);
        if (!currentUserService.isSuperAdmin(currentUser)) {
            Long shopId = currentUserService.requireShop(currentUser).getId();
            if (targetUser.getShop() == null || !targetUser.getShop().getId().equals(shopId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Cannot update another shop user"));
            }
            updates.put("shopId", String.valueOf(shopId));
            if ("SUPER_ADMIN".equalsIgnoreCase(updates.get("role"))) {
                return ResponseEntity.status(403).body(Map.of("error", "Cannot assign super admin role"));
            }
        }
        return ResponseEntity.ok(userService.updateUser(id, updates));
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<?> toggleStatus(Authentication authentication, @PathVariable Long id) {
        User currentUser = currentUserService.requireUser(authentication);
        if (!currentUserService.canManageUsers(currentUser)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not allowed"));
        }

        User targetUser = userService.getUserById(id);
        if (!currentUserService.isSuperAdmin(currentUser)
            && (targetUser.getShop() == null || !targetUser.getShop().getId().equals(currentUserService.requireShop(currentUser).getId()))) {
            return ResponseEntity.status(403).body(Map.of("error", "Cannot manage another shop user"));
        }
        return ResponseEntity.ok(userService.toggleUserStatus(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(Authentication authentication, @PathVariable Long id) {
        User currentUser = currentUserService.requireUser(authentication);
        if (!currentUserService.canManageUsers(currentUser)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not allowed"));
        }

        User targetUser = userService.getUserById(id);
        if (!currentUserService.isSuperAdmin(currentUser)
            && (targetUser.getShop() == null || !targetUser.getShop().getId().equals(currentUserService.requireShop(currentUser).getId()))) {
            return ResponseEntity.status(403).body(Map.of("error", "Cannot delete another shop user"));
        }
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
