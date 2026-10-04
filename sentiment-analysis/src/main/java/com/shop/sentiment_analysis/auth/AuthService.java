package com.shop.sentiment_analysis.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    /** Même message que le compte existe ou non : on ne révèle pas quels emails sont inscrits. */
    static final String BAD_CREDENTIALS = "Email ou mot de passe incorrect.";

    private final AppUserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService jwt;

    /** Inscription publique : crée toujours un compte CLIENT (jamais ADMIN). */
    public AuthDtos.AuthResponse register(AuthDtos.RegisterRequest req) {
        String email = normalizeEmail(req.email());
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Un compte existe déjà avec cet email.");
        }
        try {
            AppUser user = users.save(new AppUser(email, req.fullName().strip(), passwords.encode(req.password()), Role.CLIENT));
            return jwt.issue(user);
        } catch (DataIntegrityViolationException e) { // inscription simultanée avec le même email
            throw new ApiException(HttpStatus.CONFLICT, "Un compte existe déjà avec cet email.");
        }
    }

    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest req) {
        AppUser user = users.findByEmailIgnoreCase(normalizeEmail(req.email()))
                .filter(u -> passwords.matches(req.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, BAD_CREDENTIALS));
        return jwt.issue(user);
    }

    public AppUser current(Long id) {
        return users.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Compte introuvable : veuillez vous reconnecter."));
    }

    static String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
