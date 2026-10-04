package com.shop.sentiment_analysis.auth;

import com.shop.sentiment_analysis.repository.ReviewRepository;
import com.shop.sentiment_analysis.storage.FileStorageService;
import com.shop.sentiment_analysis.storage.FileStorageService.Folder;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Administration des comptes (ADMIN uniquement, cf. SecurityConfig).
 * Garde-fous : un administrateur n'agit pas sur son propre compte et le dernier administrateur est protégé.
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AppUserRepository users;
    private final ReviewRepository reviews;
    private final FileStorageService storage;

    public record UserRow(Long id, String email, String fullName, Role role, String avatarUrl, Instant createdAt, long reviewCount) {}

    @GetMapping
    public List<UserRow> list() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : reviews.countByAuthor()) counts.put((Long) row[0], (Long) row[1]);
        return users.findAllByOrderByCreatedAtDesc().stream().map(u -> row(u, counts.getOrDefault(u.getId(), 0L))).toList();
    }

    @PutMapping("/{id}/role")
    public UserRow changeRole(@AuthenticationPrincipal Jwt me, @PathVariable Long id, @Valid @RequestBody AuthDtos.RoleRequest req) {
        AppUser u = target(me, id, "modifier votre propre rôle");
        if (u.getRole() == Role.ADMIN && req.role() != Role.ADMIN) protectLastAdmin();
        u.setRole(req.role());
        users.save(u);
        return row(u, reviews.findByAuthorId(u.getId()).size());
    }

    /** Les avis du compte sont conservés pour les statistiques, mais détachés (« Ancien client »). */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt me, @PathVariable Long id) {
        AppUser u = target(me, id, "supprimer votre propre compte");
        if (u.getRole() == Role.ADMIN) protectLastAdmin();
        reviews.detachAuthor(u.getId());
        users.delete(u);
        storage.delete(Folder.AVATARS, u.getAvatarName());
    }

    private AppUser target(Jwt me, Long id, String forbiddenAction) {
        if (JwtService.userId(me).equals(id)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Vous ne pouvez pas " + forbiddenAction + ".");
        }
        return users.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable."));
    }

    private void protectLastAdmin() {
        if (users.findAllByOrderByCreatedAtDesc().stream().filter(x -> x.getRole() == Role.ADMIN).count() <= 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Impossible : la boutique doit garder au moins un administrateur.");
        }
    }

    private static UserRow row(AppUser u, long reviewCount) {
        return new UserRow(u.getId(), u.getEmail(), u.getFullName(), u.getRole(),
                FileStorageService.url(Folder.AVATARS, u.getAvatarName()), u.getCreatedAt(), reviewCount);
    }
}
