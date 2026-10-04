package com.shop.sentiment_analysis.notify;

import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.domain.SentimentLabel;

import java.time.Instant;
import java.util.List;

/**
 * Message poussé aux administrateurs : review.created (nouvel avis client), review.updated (avis modifié
 * par son auteur) ou review.deleted (avis supprimé ; seul l'id est renseigné).
 */
public record ReviewEvent(String type, Long id, String text, String product, SentimentLabel label,
                          double score, Integer rating, String authorName, List<String> imageUrls, Instant createdAt) {

    public static ReviewEvent created(Review r) { return of("review.created", r); }

    public static ReviewEvent updated(Review r) { return of("review.updated", r); }

    public static ReviewEvent deleted(Long id) {
        return new ReviewEvent("review.deleted", id, null, null, null, 0, null, null, List.of(), Instant.now());
    }

    private static ReviewEvent of(String type, Review r) {
        return new ReviewEvent(type, r.getId(), r.getText(), r.getProduct(), r.getLabel(), r.getScore(),
                r.getRating(), r.getAuthorName(), r.getImageUrls(), r.getCreatedAt());
    }
}
