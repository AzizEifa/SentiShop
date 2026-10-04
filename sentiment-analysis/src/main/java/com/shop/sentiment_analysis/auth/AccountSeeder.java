package com.shop.sentiment_analysis.auth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Au démarrage : crée le compte administrateur s'il n'existe aucun admin (l'inscription publique
 * ne crée que des clients), et un compte client de démonstration s'il est activé.
 * Les mots de passe ne sont jamais écrits dans les logs.
 */
@Slf4j
@Component
public class AccountSeeder implements ApplicationRunner {

    private final AppUserRepository users;
    private final PasswordEncoder passwords;
    private final String adminEmail, adminPassword, adminName;
    private final boolean demoEnabled;
    private final String demoEmail, demoPassword, demoName;

    public AccountSeeder(AppUserRepository users, PasswordEncoder passwords,
                         @Value("${app.admin.email}") String adminEmail,
                         @Value("${app.admin.password}") String adminPassword,
                         @Value("${app.admin.name:Administrateur}") String adminName,
                         @Value("${app.demo-client.enabled:false}") boolean demoEnabled,
                         @Value("${app.demo-client.email:}") String demoEmail,
                         @Value("${app.demo-client.password:}") String demoPassword,
                         @Value("${app.demo-client.name:Client démo}") String demoName) {
        this.users = users;
        this.passwords = passwords;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
        this.adminName = adminName;
        this.demoEnabled = demoEnabled;
        this.demoEmail = demoEmail;
        this.demoPassword = demoPassword;
        this.demoName = demoName;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!users.existsByRole(Role.ADMIN) && !users.existsByEmailIgnoreCase(adminEmail)) {
            users.save(new AppUser(AuthService.normalizeEmail(adminEmail), adminName, passwords.encode(adminPassword), Role.ADMIN));
            log.info("Compte administrateur créé : {}", adminEmail);
        }
        if (demoEnabled && !demoEmail.isBlank() && !users.existsByEmailIgnoreCase(demoEmail)) {
            users.save(new AppUser(AuthService.normalizeEmail(demoEmail), demoName, passwords.encode(demoPassword), Role.CLIENT));
            log.info("Compte client de démonstration créé : {}", demoEmail);
        }
    }
}
