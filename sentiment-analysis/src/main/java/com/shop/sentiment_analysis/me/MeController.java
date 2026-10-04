package com.shop.sentiment_analysis.me;

import com.shop.sentiment_analysis.auth.ApiException;
import com.shop.sentiment_analysis.auth.AppUser;
import com.shop.sentiment_analysis.auth.AuthService;
import com.shop.sentiment_analysis.auth.JwtService;
import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.exception.HfUnavailableException;
import com.shop.sentiment_analysis.notify.NotificationHandler;
import com.shop.sentiment_analysis.notify.ReviewEvent;
import com.shop.sentiment_analysis.product.ProductService;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import com.shop.sentiment_analysis.service.SentimentService;
import com.shop.sentiment_analysis.storage.FileStorageService;
import com.shop.sentiment_analysis.storage.FileStorageService.Folder;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Espace client : déposer, consulter, modifier et supprimer ses propres avis (avec photos).
 * Envoi en multipart : partie "review" (JSON) + parties "images" (facultatives, 3 photos max par avis).
 * Le sentiment détecté reste interne à la boutique : il n'est pas renvoyé au client.
 */
@RestController
@RequestMapping("/api/me/reviews")
@RequiredArgsConstructor
public class MeController {

    public static final int MAX_IMAGES = 3;
    private static final String AI_DOWN = "Votre avis n'a pas pu être enregistré pour le moment. Réessayez dans quelques instants.";

    private final AuthService auth;
    private final SentimentService sentiment;
    private final ReviewRepository reviews;
    private final ProductService products;
    private final FileStorageService storage;
    private final NotificationHandler notifications;

    public record ReviewForm(
            @NotBlank(message = "Choisissez le produit concerné")
            @Size(max = 120, message = "Nom de produit trop long (120 caractères max)")
            String product,
            @NotNull(message = "Donnez une note de 1 à 5 étoiles")
            @Min(value = 1, message = "La note va de 1 à 5 étoiles")
            @Max(value = 5, message = "La note va de 1 à 5 étoiles")
            Integer rating,
            @NotBlank(message = "Écrivez votre avis")
            @Size(min = 10, max = 2000, message = "Votre avis doit contenir entre 10 et 2000 caractères")
            String text,
            /** Modification : photos déjà publiées à conserver (URLs ou noms de fichiers). */
            List<String> keepImages) {}

    public record MyReview(Long id, String product, Integer rating, String text, List<String> imageUrls,
                           Instant createdAt, Instant updatedAt) {
        static MyReview of(Review r) {
            return new MyReview(r.getId(), r.getProduct(), r.getRating(), r.getText(), r.getImageUrls(), r.getCreatedAt(), r.getUpdatedAt());
        }
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public MyReview submit(@AuthenticationPrincipal Jwt jwt, @Valid @RequestPart("review") ReviewForm form,
                           @RequestPart(value = "images", required = false) List<MultipartFile> images) {
        AppUser me = auth.current(JwtService.userId(jwt));
        String product = catalogProduct(form.product());
        List<MultipartFile> files = nonEmpty(images);
        checkCount(files.size());
        List<String> saved = saveAll(files);
        Review review;
        try {
            review = sentiment.record(form.text(), product, me.getId(), me.getFullName(), form.rating(), saved).review();
        } catch (HfUnavailableException e) {
            saved.forEach(n -> storage.delete(Folder.REVIEWS, n)); // pas de photo orpheline
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, AI_DOWN);
        }
        notifications.broadcast(ReviewEvent.created(review)); // temps réel vers les administrateurs connectés
        return MyReview.of(review);
    }

    @GetMapping
    public Page<MyReview> mine(@AuthenticationPrincipal Jwt jwt,
                               @RequestParam(defaultValue = "0") int page,
                               @RequestParam(defaultValue = "20") int size) {
        return reviews.findByAuthorIdOrderByCreatedAtDesc(JwtService.userId(jwt),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50))).map(MyReview::of);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MyReview update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestPart("review") ReviewForm form,
                           @RequestPart(value = "images", required = false) List<MultipartFile> images) {
        Review review = own(jwt, id);
        String product = catalogProduct(form.product());

        // photos conservées : uniquement parmi celles de cet avis
        List<String> keep = new ArrayList<>();
        if (form.keepImages() != null) {
            for (String k : form.keepImages()) {
                String name = k == null ? null : k.substring(k.lastIndexOf('/') + 1);
                if (review.getImages().contains(name) && !keep.contains(name)) keep.add(name);
            }
        }
        List<MultipartFile> files = nonEmpty(images);
        checkCount(keep.size() + files.size());

        if (!Objects.equals(review.getText(), form.text().strip())) {
            try {
                sentiment.reanalyze(review, form.text()); // le sentiment suit le nouveau texte
            } catch (HfUnavailableException e) {
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, AI_DOWN);
            }
        }
        List<String> added = saveAll(files);
        List<String> removed = review.getImages().stream().filter(n -> !keep.contains(n)).toList();
        List<String> finalImages = new ArrayList<>(keep);
        finalImages.addAll(added);

        review.setProduct(product);
        review.setRating(form.rating());
        review.setImages(finalImages);
        review.setUpdatedAt(Instant.now());
        reviews.save(review);
        removed.forEach(n -> storage.delete(Folder.REVIEWS, n));
        notifications.broadcast(ReviewEvent.updated(review));
        return MyReview.of(review);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        Review review = own(jwt, id);
        reviews.delete(review);
        review.getImages().forEach(n -> storage.delete(Folder.REVIEWS, n));
        notifications.broadcast(ReviewEvent.deleted(id));
    }

    /** Un client n'agit que sur ses avis ; un avis d'un autre client répond « introuvable » (pas d'indice). */
    private Review own(Jwt jwt, Long id) {
        Long me = JwtService.userId(jwt);
        return reviews.findById(id).filter(r -> me.equals(r.getAuthorId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Avis introuvable."));
    }

    private String catalogProduct(String name) {
        return products.canonicalName(name)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Choisissez un produit du catalogue."));
    }

    private static List<MultipartFile> nonEmpty(List<MultipartFile> files) {
        return files == null ? List.of() : files.stream().filter(f -> f != null && !f.isEmpty()).toList();
    }

    private static void checkCount(int count) {
        if (count > MAX_IMAGES) throw new ApiException(HttpStatus.BAD_REQUEST, "3 photos maximum par avis.");
    }

    private List<String> saveAll(List<MultipartFile> files) {
        List<String> saved = new ArrayList<>();
        try {
            for (MultipartFile f : files) saved.add(storage.saveImage(f, Folder.REVIEWS));
        } catch (ApiException e) {
            saved.forEach(n -> storage.delete(Folder.REVIEWS, n));
            throw e;
        }
        return saved;
    }
}
