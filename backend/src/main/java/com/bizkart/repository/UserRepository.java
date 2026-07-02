package com.bizkart.repository;

import com.bizkart.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsernameAndShopCodeIgnoreCase(String username, String shopCode);
    Optional<User> findByUsernameAndShopIsNull(String username);
    boolean existsByUsernameAndShopId(String username, Long shopId);
    boolean existsByUsernameAndShopIsNull(String username);
    boolean existsByEmail(String email);
    List<User> findByRole(User.Role role);
    List<User> findByShopId(Long shopId);
}
