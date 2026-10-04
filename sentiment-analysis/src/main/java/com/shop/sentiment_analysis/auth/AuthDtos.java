package com.shop.sentiment_analysis.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank(message = "Le nom est requis")
            @Size(min = 2, max = 120, message = "Le nom doit contenir entre 2 et 120 caractères")
            String fullName,
            @NotBlank(message = "L'email est requis")
            @Email(message = "Adresse email invalide")
            @Size(max = 160, message = "Email trop long")
            String email,
            @NotBlank(message = "Le mot de passe est requis")
            @Size(min = 8, max = 72, message = "Le mot de passe doit contenir au moins 8 caractères")
            @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", message = "Le mot de passe doit contenir au moins une lettre et un chiffre")
            String password) {}

    public record LoginRequest(
            @NotBlank(message = "L'email est requis") String email,
            @NotBlank(message = "Le mot de passe est requis") String password) {}

    public record UserDto(Long id, String email, String fullName, Role role, Instant createdAt) {
        public static UserDto of(AppUser u) {
            return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getCreatedAt());
        }
    }

    /** Réponse de connexion / inscription : le jeton à envoyer dans l'en-tête Authorization. */
    public record AuthResponse(String token, Instant expiresAt, UserDto user) {}
}
