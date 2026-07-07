package com.bizkart.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "shops")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Shop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 30)
    private String defaultLanguage = "en";

    @Column(nullable = false, length = 60)
    private String businessType = "Kirana Store";

    @Column(length = 80)
    private String ownerName;

    @Column(length = 20)
    private String phone;

    @Column(length = 255)
    private String address;

    // Intentionally NOT @Lob. On PostgreSQL, Hibernate maps a @Lob String to
    // an "oid" large-object column and reads it back through the JDBC CLOB
    // stream API (ClobJdbcType / DataHelper.extractString) — that stream
    // access is what throws "Unable to access lob stream" (seen on the
    // customer shop-list/select flow, which is the first place that
    // actually reads this column back out of the DB). Base64 data-URIs
    // stored here are plain text, not a real binary large object, so a
    // TEXT column read as a normal String avoids the CLOB path entirely.
    @Column(name = "upi_qr_image", columnDefinition = "TEXT")
    private String upiQrImage;

    private Double latitude;
    private Double longitude;

    @Column(length = 80, unique = true)
    private String publicSlug;

    @Column(nullable = false)
    private boolean enabled = true;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
