package com.bizkart.config;

import com.bizkart.service.ProductService;
import com.bizkart.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final ProductService productService;
    private final UserService userService;
    private final UserRoleConstraintMigrator userRoleConstraintMigrator;
    private final OrderConstraintMigrator orderConstraintMigrator;
    private final UserUsernameConstraintMigrator userUsernameConstraintMigrator;

    public DataInitializer(
        ProductService productService,
        UserService userService,
        UserRoleConstraintMigrator userRoleConstraintMigrator,
        OrderConstraintMigrator orderConstraintMigrator,
        UserUsernameConstraintMigrator userUsernameConstraintMigrator
    ) {
        this.productService = productService;
        this.userService = userService;
        this.userRoleConstraintMigrator = userRoleConstraintMigrator;
        this.orderConstraintMigrator = orderConstraintMigrator;
        this.userUsernameConstraintMigrator = userUsernameConstraintMigrator;
    }

    @Override
    public void run(String... args) {
        userRoleConstraintMigrator.alignUsersRoleConstraint();
        orderConstraintMigrator.alignOrderConstraints();
        userUsernameConstraintMigrator.alignUsersUsernameScope();
        userService.initDefaultUsers();
        log.info("Application data initialization completed");
    }
}
