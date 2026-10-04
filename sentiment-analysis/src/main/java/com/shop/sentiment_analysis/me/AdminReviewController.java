package com.shop.sentiment_analysis.me;

import com.shop.sentiment_analysis.auth.ApiException;
import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.notify.NotificationHandler;
import com.shop.sentiment_analysis.notify.ReviewEvent;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import com.shop.sentiment_analysis.storage.FileStorageService;
import com.shop.sentiment_analysis.storage.FileStorageService.Folder;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** Modération des avis par l'administrateur (ADMIN uniquement, cf. SecurityConfig). */
@RestController
@RequestMapping("/api/admin/reviews")
@RequiredArgsConstructor
public class AdminReviewController {

    private final ReviewRepository reviews;
    private final FileStorageService storage;
    private final NotificationHandler notifications;

    @GetMapping("/{id}")
    public Review get(@PathVariable Long id) {
        return find(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        Review review = find(id);
        reviews.delete(review);
        review.getImages().forEach(n -> storage.delete(Folder.REVIEWS, n));
        notifications.broadcast(ReviewEvent.deleted(id)); // les autres écrans admin se mettent à jour
    }

    private Review find(Long id) {
        return reviews.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Avis introuvable."));
    }
}
