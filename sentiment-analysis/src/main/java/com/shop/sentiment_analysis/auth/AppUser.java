package com.shop.sentiment_analysis.auth;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Compte utilisateur. Jamais renvoyé tel quel par l'API (voir AuthDtos.UserDto). */
@Entity
@Table(name = "app_user")
@Getter @Setter @NoArgsConstructor
public class AppUser {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 160)
    private String email;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Role role;

    /** Photo de profil dans uploads/avatars (null : initiales). */
    @Column(name = "avatar_name", length = 60)
    private String avatarName;

    private Instant createdAt = Instant.now();

    public AppUser(String email, String fullName, String passwordHash, Role role) {
        this.email = email;
        this.fullName = fullName;
        this.passwordHash = passwordHash;
        this.role = role;
    }
}
