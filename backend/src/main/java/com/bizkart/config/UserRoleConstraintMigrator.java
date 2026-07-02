package com.bizkart.config;

import com.bizkart.model.User;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.stream.Collectors;

@Component
public class UserRoleConstraintMigrator {

    private final JdbcTemplate jdbcTemplate;

    public UserRoleConstraintMigrator(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void alignUsersRoleConstraint() {
        String allowedRoles = Arrays.stream(User.Role.values())
            .map(role -> "'" + role.name() + "'")
            .collect(Collectors.joining(", "));

        jdbcTemplate.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        jdbcTemplate.execute(
            "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (" + allowedRoles + "))"
        );
    }
}
