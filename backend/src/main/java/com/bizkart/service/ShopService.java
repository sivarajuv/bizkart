package com.bizkart.service;

import com.bizkart.model.Shop;
import com.bizkart.repository.ShopRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ShopService {

    private final ShopRepository shopRepository;
    private final JdbcTemplate jdbcTemplate;

    public ShopService(ShopRepository shopRepository, JdbcTemplate jdbcTemplate) {
        this.shopRepository = shopRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public record ShopRequest(
        String code,
        String name,
        String defaultLanguage,
        String businessType,
        String ownerName,
        String phone,
        String address,
        String upiQrImage
    ) {}

    public List<Shop> getAllShops() {
        return shopRepository.findAll().stream()
            .sorted((left, right) -> left.getName().compareToIgnoreCase(right.getName()))
            .toList();
    }

    public Shop getShopById(Long id) {
        return shopRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Shop not found"));
    }

    public Shop createShop(ShopRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new RuntimeException("Shop name is required");
        }

        String code = normalizeCode(request.code(), request.name());
        if (shopRepository.existsByCode(code)) {
            throw new RuntimeException("Shop code already exists");
        }

        Shop shop = new Shop();
        shop.setCode(code);
        shop.setName(request.name().trim());
        shop.setDefaultLanguage(request.defaultLanguage() == null || request.defaultLanguage().isBlank() ? "en" : request.defaultLanguage());
        shop.setBusinessType(request.businessType() == null || request.businessType().isBlank() ? "Kirana Store" : request.businessType().trim());
        shop.setOwnerName(request.ownerName());
        shop.setPhone(request.phone());
        shop.setAddress(request.address());
        shop.setUpiQrImage(normalizeNullableText(request.upiQrImage()));
        shop.setEnabled(true);
        return shopRepository.save(shop);
    }

    public Shop updateShop(Long id, Map<String, String> updates) {
        Shop shop = getShopById(id);
        if (updates.containsKey("name")) {
            shop.setName(updates.get("name"));
        }
        if (updates.containsKey("defaultLanguage")) {
            shop.setDefaultLanguage(updates.get("defaultLanguage"));
        }
        if (updates.containsKey("businessType")) {
            shop.setBusinessType(updates.get("businessType"));
        }
        if (updates.containsKey("ownerName")) {
            shop.setOwnerName(updates.get("ownerName"));
        }
        if (updates.containsKey("phone")) {
            shop.setPhone(updates.get("phone"));
        }
        if (updates.containsKey("address")) {
            shop.setAddress(updates.get("address"));
        }
        if (updates.containsKey("upiQrImage")) {
            shop.setUpiQrImage(normalizeNullableText(updates.get("upiQrImage")));
        }
        return shopRepository.save(shop);
    }

    public Shop toggleStatus(Long id) {
        Shop shop = getShopById(id);
        shop.setEnabled(!shop.isEnabled());
        return shopRepository.save(shop);
    }

    @Transactional
    public void deleteShop(Long id) {
        Shop shop = getShopById(id);

        jdbcTemplate.update("DELETE FROM ledger_entries WHERE shop_id = ?", id);
        jdbcTemplate.update("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE shop_id = ?)", id);
        jdbcTemplate.update("DELETE FROM orders WHERE shop_id = ?", id);
        jdbcTemplate.update("DELETE FROM product_translations WHERE product_id IN (SELECT id FROM products WHERE shop_id = ?)", id);
        jdbcTemplate.update("DELETE FROM products WHERE shop_id = ?", id);
        jdbcTemplate.update("DELETE FROM customers WHERE shop_id = ?", id);
        jdbcTemplate.update("DELETE FROM users WHERE shop_id = ?", id);
        shopRepository.delete(shop);
    }

    public Shop ensureActiveShop(Long id) {
        Shop shop = getShopById(id);
        if (!shop.isEnabled()) {
            throw new RuntimeException("Shop is disabled");
        }
        return shop;
    }

    private String normalizeCode(String requestedCode, String fallbackName) {
        String base = requestedCode == null || requestedCode.isBlank() ? fallbackName : requestedCode;
        String normalized = base.toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-|-$", "");
        return normalized.isBlank() ? "shop" : normalized;
    }

    private String normalizeNullableText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
