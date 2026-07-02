package com.bizkart.config;

import com.bizkart.model.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.stream.Collectors;

@Component
public class OrderConstraintMigrator {

    private final JdbcTemplate jdbcTemplate;

    public OrderConstraintMigrator(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void alignOrderConstraints() {
        alignConstraint(
            "orders",
            "orders_payment_method_check",
            "payment_method",
            Arrays.stream(Order.PaymentMethod.values())
                .map(Order.PaymentMethod::name)
                .collect(Collectors.toList())
        );

        alignConstraint(
            "orders",
            "orders_payment_status_check",
            "payment_status",
            Arrays.stream(Order.PaymentStatus.values())
                .map(Order.PaymentStatus::name)
                .collect(Collectors.toList())
        );

        alignConstraint(
            "orders",
            "orders_status_check",
            "status",
            Arrays.stream(Order.OrderStatus.values())
                .map(Order.OrderStatus::name)
                .collect(Collectors.toList())
        );
    }

    private void alignConstraint(String tableName, String constraintName, String columnName, java.util.List<String> allowedValues) {
        String joinedValues = allowedValues.stream()
            .map(value -> "'" + value + "'")
            .collect(Collectors.joining(", "));

        jdbcTemplate.execute("ALTER TABLE " + tableName + " DROP CONSTRAINT IF EXISTS " + constraintName);
        jdbcTemplate.execute(
            "ALTER TABLE " + tableName
                + " ADD CONSTRAINT " + constraintName
                + " CHECK (" + columnName + " IN (" + joinedValues + "))"
        );
    }
}
