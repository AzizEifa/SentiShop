package com.shop.sentiment_analysis.auth;

import com.shop.sentiment_analysis.repository.ReviewRepository;
import com.shop.sentiment_analysis.storage.FileStorageService;
import com.shop.sentiment_analysis.storage.FileStorageService.Folder;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Mon profil (tout utilisateur connecté, client comme administrateur).
 * Le nom et l'email étant dans le jeton, leur modification renvoie un nouveau jeton.
 */
@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private final AuthService auth;
    private final AppUserRepository users;
    private final ReviewRepository reviews;
    private final PasswordEncoder passwords;
    private final FileStorageService storage;
    private final JwtService jwt;

    @GetMapping
    public AuthDtos.UserDto me(@AuthenticationPrincipal Jwt token) {
        return AuthDtos.UserDto.of(current(token));
    }

    @PutMapping
    public AuthDtos.AuthResponse updateProfile(@AuthenticationPrincipal Jwt token, @Valid @RequestBody AuthDtos.ProfileRequest req) {
        AppUser me = current(token);
        String email = AuthService.normalizeEmail(req.email());
        if (!email.equals(me.getEmail()) && users.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Un compte existe déjà avec cet email.");
        }
        String name = req.fullName().strip();
        boolean renamed = !name.equals(me.getFullName());
        me.setEmail(email);
        me.setFullName(name);
        users.save(me);
        if (renamed) reviews.renameAuthor(me.getId(), name); // ses avis affichent le nouveau nom
        return jwt.issue(me);
    }

    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal Jwt token, @Valid @RequestBody AuthDtos.PasswordRequest req) {
        AppUser me = current(token);
        if (!passwords.matches(req.currentPassword(), me.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mot de passe actuel incorrect.");
        }
        if (passwords.matches(req.newPassword(), me.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le nouveau mot de passe doit être différent de l'actuel.");
        }
        me.setPasswordHash(passwords.encode(req.newPassword()));
        users.save(me);
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AuthDtos.UserDto uploadAvatar(@AuthenticationPrincipal Jwt token, @RequestPart("image") MultipartFile image) {
        AppUser me = current(token);
        String old = me.getAvatarName();
        me.setAvatarName(storage.saveImage(image, Folder.AVATARS));
        users.save(me);
        storage.delete(Folder.AVATARS, old);
        return AuthDtos.UserDto.of(me);
    }

    @DeleteMapping("/avatar")
    public AuthDtos.UserDto removeAvatar(@AuthenticationPrincipal Jwt token) {
        AppUser me = current(token);
        storage.delete(Folder.AVATARS, me.getAvatarName());
        me.setAvatarName(null);
        users.save(me);
        return AuthDtos.UserDto.of(me);
    }

    private AppUser current(Jwt token) {
        return auth.current(JwtService.userId(token));
    }
}
