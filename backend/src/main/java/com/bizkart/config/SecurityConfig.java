package com.bizkart.config;

import com.bizkart.security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, UserDetailsService userDetailsService) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.userDetailsService = userDetailsService;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth

                // ── Staff auth ────────────────────────────────────────────
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/refresh").permitAll()

                // ── Customer portal auth (fully public) ───────────────────
                .requestMatchers(HttpMethod.POST, "/api/customer-auth/register").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/customer-auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/customer-auth/reset-password").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/customer-auth/me").permitAll()

                // ── Customer portal reads (public) ────────────────────────
                .requestMatchers(HttpMethod.GET, "/api/portal/shops").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/portal/products").permitAll()

                // ── Customer portal orders (JWT validated in controller) ───
                .requestMatchers("/api/portal/**").permitAll()

                // ── Static / SPA ──────────────────────────────────────────
                .requestMatchers(
                    "/",
                    "/index.html",
                    "/static/**",
                    "/assets/**",
                    "/*.js",
                    "/*.css",
                    "/favicon.ico",
                    "/manifest.json",
                    "/service-worker.js",
                    "/logo192.png",
                    "/logo512.png",
                    // SPA client-side routes — must all serve index.html without auth
                    "/admin",
                    "/admin/**",
                    "/shop",
                    "/shop/**",
                    "/s/**",
                    "/portal",
                    "/portal/**"
                ).permitAll()

                // ── Products ──────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/api/products/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER")
                .requestMatchers(HttpMethod.POST, "/api/products/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")
                .requestMatchers(HttpMethod.PUT, "/api/products/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")
                .requestMatchers(HttpMethod.PATCH, "/api/products/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")
                .requestMatchers(HttpMethod.DELETE, "/api/products/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")

                // ── POS Orders ────────────────────────────────────────────
                .requestMatchers(HttpMethod.POST, "/api/orders")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER")
                .requestMatchers(HttpMethod.GET, "/api/orders/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER")

                // ── Online Orders (shop staff) ────────────────────────────
                .requestMatchers("/api/shop-orders/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER")

                // ── Public shop page (shareable URL) ─────────────────────
                .requestMatchers(HttpMethod.GET, "/api/public/shops/**").permitAll()

                // ── Admin coupon management ───────────────────────────────
                .requestMatchers("/api/admin/coupons/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")

                // ── Admin analytics ───────────────────────────────────────
                .requestMatchers("/api/admin/analytics/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")

                // ── Admin pricing suggestions ─────────────────────────────
                .requestMatchers("/api/admin/pricing/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")

                // ── Admin SMS marketing ───────────────────────────────────
                .requestMatchers("/api/admin/sms-campaigns/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")

                // ── AI ────────────────────────────────────────────────────
                .requestMatchers("/api/ai/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")

                // ── Users ─────────────────────────────────────────────────
                .requestMatchers("/api/users/**")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN")

                // ── Shops ─────────────────────────────────────────────────
                // More specific pattern must be registered before the general
                // /api/shops/** catch-all below, or Spring Security's ordered
                // matcher list would apply the SUPER_ADMIN-only rule to this
                // path too and shop staff could never reach it.
                .requestMatchers(HttpMethod.PATCH, "/api/shops/my/whatsapp-phone")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")
                .requestMatchers(HttpMethod.PATCH, "/api/shops/my/upi-qr-image")
                    .hasAnyRole("SUPER_ADMIN", "ADMIN", "MANAGER")
                .requestMatchers("/api/shops/**")
                    .hasRole("SUPER_ADMIN")

                .anyRequest().authenticated()
            )
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                "http://localhost:3000",
                "https://mybizkart.in",
                "https://www.mybizkart.in",
                // Native app shells (Capacitor) load the bundled UI from a local
                // scheme rather than the deployed domain, so their web-view origin
                // must be explicitly allow-listed too, or every API call 401/CORS-fails
                // only in the Android/iOS app while working fine on the website.
                "https://localhost",       // Capacitor Android default origin (androidScheme: https)
                "capacitor://localhost",   // Capacitor iOS default origin
                "http://localhost"         // Capacitor Android fallback when androidScheme: http
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
