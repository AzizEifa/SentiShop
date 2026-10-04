package com.shop.sentiment_analysis.me;

import com.shop.sentiment_analysis.auth.ApiException;
import com.shop.sentiment_analysis.auth.AppUser;
import com.shop.sentiment_analysis.auth.AuthService;
import com.shop.sentiment_analysis.auth.JwtService;
import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.exception.HfUnavailableException;
import com.shop.sentiment_analysis.notify.NotificationHandler;
import com.shop.sentiment_analysis.notify.ReviewEvent;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import com.shop.sentiment_analysis.service.SentimentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

/**
 * Espace client : déposer un avis et consulter les siens.
 * Le sentiment détecté reste interne à la boutique : il n'est pas renvoyé au client.
 */
@RestController
@RequestMapping("/api/me/reviews")
@RequiredArgsConstructor
public class MeController {

    private final AuthService auth;
    private final SentimentService sentiment;
    private final ReviewRepository reviews;
    private final NotificationHandler notifications;

    public record SubmitReviewRequest(
            @NotBlank(message = "Choisissez le produit concerné")
            @Size(max = 120, message = "Nom de produit trop long (120 caractères max)")
            String product,
            @NotNull(message = "Donnez une note de 1 à 5 étoiles")
            @Min(value = 1, message = "La note va de 1 à 5 étoiles")
            @Max(value = 5, message = "La note va de 1 à 5 étoiles")
            Integer rating,
            @NotBlank(message = "Écrivez votre avis")
            @Size(min = 10, max = 2000, message = "Votre avis doit contenir entre 10 et 2000 caractères")
            String text) {}

    public record MyReview(Long id, String product, Integer rating, String text, Instant createdAt) {
        static MyReview of(Review r) {
            return new MyReview(r.getId(), r.getProduct(), r.getRating(), r.getText(), r.getCreatedAt());
        }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MyReview submit(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SubmitReviewRequest req) {
        AppUser me = auth.current(JwtService.userId(jwt));
        Review saved;
        try {
            saved = sentiment.record(req.text(), req.product(), me.getId(), me.getFullName(), req.rating()).review();
        } catch (HfUnavailableException e) {
            // message pensé pour un client, pas pour un développeur
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Votre avis n'a pas pu être enregistré pour le moment. Réessayez dans quelques instants.");
        }
        notifications.broadcast(ReviewEvent.created(saved)); // temps réel vers les administrateurs connectés
        return MyReview.of(saved);
    }

    @GetMapping
    public Page<MyReview> mine(@AuthenticationPrincipal Jwt jwt,
                               @RequestParam(defaultValue = "0") int page,
                               @RequestParam(defaultValue = "20") int size) {
        return reviews.findByAuthorIdOrderByCreatedAtDesc(JwtService.userId(jwt),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50))).map(MyReview::of);
    }
}
