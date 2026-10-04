package com.shop.sentiment_analysis.notify;

import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.domain.SentimentLabel;

import java.time.Instant;

/** Message poussé aux administrateurs quand un client dépose un avis. */
public record ReviewEvent(String type, Long id, String text, String product, SentimentLabel label,
                          double score, Integer rating, String authorName, Instant createdAt) {

    public static ReviewEvent created(Review r) {
        return new ReviewEvent("review.created", r.getId(), r.getText(), r.getProduct(), r.getLabel(),
                r.getScore(), r.getRating(), r.getAuthorName(), r.getCreatedAt());
    }
}
