package com.shop.sentiment_analysis.dto;

import com.shop.sentiment_analysis.domain.SentimentLabel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class Dtos {
    private Dtos() {}

    public record AnalyzeRequest(@NotBlank @Size(max = 2000) String text, @Size(max = 120) String product) {}
    public record AnalyzeResponse(SentimentLabel label, double score, boolean cached) {}
    public record ClassResult(SentimentLabel label, double score) {}
    public record ImportReport(int total, int analyzed, int cacheHits, List<String> errors) {}
    public record DashboardStats(long positive, long neutral, long negative, long total,
                                 double positivePct, double neutralPct, double negativePct) {}
    public record SummaryResponse(String summary, int reviewsUsed) {}
    /** Nombre d'avis par sentiment pour un jour (yyyy-MM-dd, fuseau du serveur). */
    public record TrendPoint(String date, long positive, long neutral, long negative) {}
}
