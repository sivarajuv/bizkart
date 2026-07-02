package com.bizkart.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class UserUsernameConstraintMigrator {

    private static final Logger log = LoggerFactory.getLogger(UserUsernameConstraintMigrator.class);
    private static final String PLATFORM_USERNAME_INDEX = "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_platform_username_unique ON users (username) WHERE shop_id IS NULL";

    private final JdbcTemplate jdbcTemplate;

    public UserUsernameConstraintMigrator(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void alignUsersUsernameScope() {
        jdbcTemplate.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key");
        jdbcTemplate.execute("DROP INDEX IF EXISTS users_username_key");
        jdbcTemplate.execute("DROP INDEX IF EXISTS uk_users_username");
        jdbcTemplate.execute("DROP INDEX IF EXISTS idx_users_username_unique");
        jdbcTemplate.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_shop_username_unique ON users (shop_id, username)");

        String databaseProductName = jdbcTemplate.execute((ConnectionCallback<String>) connection ->
            connection.getMetaData().getDatabaseProductName()
        );

        if (databaseProductName != null && databaseProductName.toLowerCase().contains("h2")) {
            log.info("Skipping platform username partial index for H2 because the syntax is PostgreSQL-specific");
            return;
        }

        jdbcTemplate.execute(PLATFORM_USERNAME_INDEX);
    }
}
