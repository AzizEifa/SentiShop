package com.shop.sentiment_analysis.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/** Émet les jetons signés (HS256). Le décodage est fait par Spring Security (SecurityConfig). */
@Service
public class JwtService {

    public static final String CLAIM_ROLE = "role";
    public static final String CLAIM_NAME = "name";
    public static final String CLAIM_UID = "uid";

    private final JwtEncoder encoder;
    private final Duration ttl;

    public JwtService(JwtEncoder encoder, @Value("${app.jwt.ttl:8h}") Duration ttl) {
        this.encoder = encoder;
        this.ttl = ttl;
    }

    public AuthDtos.AuthResponse issue(AppUser user) {
        Instant now = Instant.now();
        Instant exp = now.plus(ttl);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("sentishop")
                .subject(user.getEmail())
                .issuedAt(now)
                .expiresAt(exp)
                .claim(CLAIM_UID, user.getId())
                .claim(CLAIM_ROLE, user.getRole().name())
                .claim(CLAIM_NAME, user.getFullName())
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        return new AuthDtos.AuthResponse(token, exp, AuthDtos.UserDto.of(user));
    }

    /** Identifiant de l'utilisateur porté par le jeton. */
    public static Long userId(Jwt jwt) {
        Object uid = jwt.getClaim(CLAIM_UID);
        return uid instanceof Number n ? n.longValue() : Long.valueOf(String.valueOf(uid));
    }
}
