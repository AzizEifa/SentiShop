package com.shop.sentiment_analysis.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Droits d'accès :
 *  - public       : inscription, connexion, santé de l'API, documentation Swagger, WebSocket (authentifié au 1er message)
 *  - public       : images envoyées (/uploads/**, noms aléatoires)
 *  - connecté     : /api/auth/me, /api/account/** (mon profil), lecture du catalogue /api/products
 *  - CLIENT       : /api/me/** (déposer et consulter ses propres avis)
 *  - ADMIN        : tout le reste de /api/** (dashboard, analyse, import, export, comparaison,
 *                   gestion des produits, des avis et des utilisateurs : /api/admin/**)
 * Sans session côté serveur : chaque requête porte un jeton JWT (en-tête Authorization: Bearer …).
 */
@Configuration
public class SecurityConfig {

    private final SecretKey key;

    public SecurityConfig(@Value("${app.jwt.secret}") String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("app.jwt.secret (JWT_SECRET) doit contenir au moins 32 caractères");
        }
        this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)            // API sans cookie : pas de CSRF possible
                .cors(Customizer.withDefaults())                  // réutilise la config CORS de AppConfig
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h.frameOptions(f -> f.sameOrigin())) // console H2 en développement
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                        .requestMatchers("/actuator/health", "/ws/**", "/h2-console/**",
                                "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        // images (noms aléatoires impossibles à deviner), affichées par <img> sans en-tête Authorization
                        .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                        .requestMatchers("/api/auth/me", "/api/account/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/products").authenticated()
                        .requestMatchers("/api/me/**").hasRole(Role.CLIENT.name())
                        .requestMatchers("/api/**").hasRole(Role.ADMIN.name())
                        .anyRequest().denyAll())
                .oauth2ResourceServer(o -> o
                        .jwt(j -> j.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                        .authenticationEntryPoint(unauthorized()))
                .exceptionHandling(e -> e.authenticationEntryPoint(unauthorized()).accessDeniedHandler(forbidden()));
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    JwtEncoder jwtEncoder() {
        return new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    @Bean
    JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }

    /** Le claim "role" (ADMIN / CLIENT) devient l'autorité ROLE_ADMIN / ROLE_CLIENT. */
    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        var roles = new JwtGrantedAuthoritiesConverter();
        roles.setAuthoritiesClaimName(JwtService.CLAIM_ROLE);
        roles.setAuthorityPrefix("ROLE_");
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(roles);
        return converter;
    }

    private AuthenticationEntryPoint unauthorized() {
        return (req, res, ex) -> problem(res, HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized",
                "Session expirée ou absente : veuillez vous connecter.");
    }

    private AccessDeniedHandler forbidden() {
        return (req, res, ex) -> problem(res, HttpServletResponse.SC_FORBIDDEN, "Forbidden",
                "Accès refusé : cette action n'est pas autorisée pour votre compte.");
    }

    private static void problem(HttpServletResponse res, int status, String title, String detail) throws IOException {
        res.setStatus(status);
        res.setContentType("application/problem+json;charset=UTF-8");
        res.getWriter().write("{\"type\":\"about:blank\",\"title\":\"" + title + "\",\"status\":" + status
                + ",\"detail\":\"" + detail.replace("\"", "\\\"") + "\"}");
    }
}
