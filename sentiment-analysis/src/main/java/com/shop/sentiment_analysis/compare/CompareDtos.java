package com.shop.sentiment_analysis.compare;

import com.shop.sentiment_analysis.domain.SentimentLabel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** B3 : comparaison du modèle multilingue avec un modèle entraîné uniquement sur l'anglais. */
public final class CompareDtos {
    private CompareDtos() {}

    public record CompareRequest(@NotBlank @Size(max = 2000) String text) {}

    public record ModelResult(String model, SentimentLabel label, double score, boolean cached) {}

    public record CompareResponse(ModelResult multilingual, ModelResult english, boolean agree) {}
}
