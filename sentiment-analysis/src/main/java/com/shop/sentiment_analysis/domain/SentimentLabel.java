package com.shop.sentiment_analysis.domain;

public enum SentimentLabel {
    POSITIVE, NEUTRAL, NEGATIVE;

    /** Gère "positive/neutral/negative" et aussi LABEL_0/1/2 (negative, neutral, positive). */
    public static SentimentLabel from(String raw) {
        return switch (raw.toLowerCase()) {
            case "positive", "label_2" -> POSITIVE;
            case "neutral", "label_1" -> NEUTRAL;
            case "negative", "label_0" -> NEGATIVE;
            default -> throw new IllegalArgumentException("Label inconnu: " + raw);
        };
    }
}
