package com.shop.sentiment_analysis.service;

import com.shop.sentiment_analysis.client.HuggingFaceClient;
import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumMap;
import java.util.List;
import java.util.TreeMap;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ReviewRepository repo;
    private final HuggingFaceClient client;
    private final ZoneId zone = ZoneId.systemDefault();

    /** Nombre maximal de jours d'une série temporelle. */
    static final int MAX_DAYS = 366;

    /** days null : toute la période ; sinon les N derniers jours (aujourd'hui compris). */
    public Dtos.DashboardStats stats(String product, Integer days) {
        Map<SentimentLabel, Long> m = new EnumMap<>(SentimentLabel.class);
        for (Object[] row : repo.countByLabel(nullToEmpty(product), since(days))) {
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

    /** Un point par jour sur les N derniers jours, jours sans avis compris (à zéro). */
    public List<Dtos.TrendPoint> trend(String product, int days) {
        int n = Math.max(1, Math.min(days, MAX_DAYS));
        LocalDate first = LocalDate.now(zone).minusDays(n - 1L);
        Map<LocalDate, long[]> buckets = new TreeMap<>();
        for (int i = 0; i < n; i++) buckets.put(first.plusDays(i), new long[3]);
        for (Object[] row : repo.timeline(nullToEmpty(product), first.atStartOfDay(zone).toInstant())) {
            long[] b = buckets.get(LocalDate.ofInstant((Instant) row[0], zone));
            if (b != null) b[((SentimentLabel) row[1]).ordinal()]++;
        }
        return buckets.entrySet().stream()
                .map(e -> new Dtos.TrendPoint(e.getKey().toString(), e.getValue()[0], e.getValue()[1], e.getValue()[2]))
                .toList();
    }

    private Instant since(Integer days) {
        if (days == null || days <= 0) return Instant.EPOCH;
        return LocalDate.now(zone).minusDays(Math.min(days, MAX_DAYS) - 1L).atStartOfDay(zone).toInstant();
    }

    private static String nullToEmpty(String s) { return s == null ? "" : s.strip(); }

    private static double pct(long v, long t) {
        return t == 0 ? 0 : Math.round(v * 1000.0 / t) / 10.0;
    }
}
