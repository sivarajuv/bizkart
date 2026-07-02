package com.bizkart.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "product_translations", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"product_id", "languageCode"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductTranslation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, length = 10)
    private String languageCode;

    @Column(nullable = false, length = 180)
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String description;
}
