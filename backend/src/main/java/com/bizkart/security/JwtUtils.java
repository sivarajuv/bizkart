package com.bizkart.security;

import com.bizkart.model.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtUtils {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration}")
    private long jwtExpiration;

    @Value("${jwt.refresh-expiration}")
    private long refreshExpiration;

    // 30 days for customer tokens
    private static final long CUSTOMER_TOKEN_EXPIRATION = 30L * 24 * 60 * 60 * 1000;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    // ── Staff / Admin token ────────────────────────────────────────────────

    public String generateToken(UserDetails userDetails, User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole().name());
        claims.put("type", "STAFF");
        if (user.getShop() != null) {
            claims.put("shopId", user.getShop().getId());
            claims.put("shopCode", user.getShop().getCode());
        }
        return buildToken(claims, userDetails.getUsername(), jwtExpiration);
    }

    public String generateRefreshToken(UserDetails userDetails) {
        return buildToken(new HashMap<>(), userDetails.getUsername(), refreshExpiration);
    }

    // ── Customer portal token ──────────────────────────────────────────────

    public String generateCustomerToken(Long customerId, String phone) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("phone", phone);
        claims.put("type", "CUSTOMER");
        return buildToken(claims, "CUSTOMER_" + customerId, CUSTOMER_TOKEN_EXPIRATION);
    }

    public Long getCustomerIdFromToken(String token) {
        String subject = extractUsername(token);
        if (!subject.startsWith("CUSTOMER_")) {
            throw new RuntimeException("Not a customer token");
        }
        return Long.parseLong(subject.replace("CUSTOMER_", ""));
    }

    public boolean isCustomerToken(String token) {
        try {
            String type = extractClaim(token, c -> c.get("type", String.class));
            return "CUSTOMER".equals(type);
        } catch (Exception e) {
            return false;
        }
    }

    // ── Shared helpers ─────────────────────────────────────────────────────

    private String buildToken(Map<String, Object> claims, String subject, long expiration) {
        return Jwts.builder()
            .claims(claims)
            .subject(subject)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(getSigningKey())
            .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public String extractRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        return claimsResolver.apply(extractAllClaims(token));
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public long getExpirationMs() {
        return jwtExpiration;
    }
}
