package com.bizkart.security;

import com.bizkart.model.User;
import com.bizkart.service.UserLoginIdentityService;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserLoginIdentityService userLoginIdentityService;

    public UserDetailsServiceImpl(UserLoginIdentityService userLoginIdentityService) {
        this.userLoginIdentityService = userLoginIdentityService;
    }

    @Override
    public UserDetails loadUserByUsername(String principal) throws UsernameNotFoundException {
        User user;
        try {
            user = userLoginIdentityService.requireUser(principal);
        } catch (RuntimeException exception) {
            throw new UsernameNotFoundException("User not found for login identity: " + principal, exception);
        }

        if (!user.isEnabled()) {
            throw new UsernameNotFoundException("User account is disabled: " + principal);
        }

        return new org.springframework.security.core.userdetails.User(
            userLoginIdentityService.buildPrincipal(user),
            user.getPassword(),
            List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }
}
