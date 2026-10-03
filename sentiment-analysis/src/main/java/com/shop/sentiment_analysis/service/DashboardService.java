package com.shop.sentiment_analysis.service;

import com.shop.sentiment_analysis.client.HuggingFaceClient;
import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ReviewRepository repo;
    private final HuggingFaceClient client;

    public Dtos.DashboardStats stats(String product) {
        Map<SentimentLabel, Long> m = new EnumMap<>(SentimentLabel.class);
        for (Object[] row : repo.countByLabel(nullToEmpty(product))) {
            m.put((SentimentLabel) row[0], (Long) row[1]);
        }
        long p = m.getOrDefault(SentimentLabel.POSITIVE, 0L);
        long n = m.getOrDefault(SentimentLabel.NEUTRAL, 0L);
        long g = m.getOrDefault(SentimentLabel.NEGATIVE, 0L);
        long t = p + n + g;
        return new Dtos.DashboardStats(p, n, g, t, pct(p, t), pct(n, t), pct(g, t));
    }

    /** Résume les 30 avis négatifs les plus récents (BART, modèle anglais). */
    public Dtos.SummaryResponse summarizeNegatives(String product) {
        var list = repo.searchByLabel(SentimentLabel.NEGATIVE, nullToEmpty(product), PageRequest.of(0, 30)).getContent();
        if (list.isEmpty()) return new Dtos.SummaryResponse("Aucun avis négatif.", 0);
        String joined = list.stream().map(Review::getText).collect(Collectors.joining(". "));
        if (joined.length() > 3000) joined = joined.substring(0, 3000);
        return new Dtos.SummaryResponse(client.summarize(joined), list.size());
    }

    private static String nullToEmpty(String s) { return s == null ? "" : s.strip(); }

    private static double pct(long v, long t) {
        return t == 0 ? 0 : Math.round(v * 1000.0 / t) / 10.0;
    }
}
