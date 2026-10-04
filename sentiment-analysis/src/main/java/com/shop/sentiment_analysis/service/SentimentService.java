package com.shop.sentiment_analysis.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.shop.sentiment_analysis.cache.ReviewHasher;
import com.shop.sentiment_analysis.client.HuggingFaceClient;
import com.shop.sentiment_analysis.config.HuggingFaceProperties;
import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Cache à 2 niveaux : Caffeine (mémoire) puis base de données.
 * L'API Hugging Face n'est appelée qu'en cas d'échec des deux.
 * Pas de @Transactional : on ne garde pas de connexion BDD ouverte pendant l'appel HTTP.
 */
@Service
@RequiredArgsConstructor
public class SentimentService {

    private final HuggingFaceClient client;
    private final ReviewRepository repo;
    private final HuggingFaceProperties props;

    private final Cache<String, Dtos.ClassResult> memory = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofDays(7))
            .build();

    public Dtos.AnalyzeResponse analyze(String rawText, String product) {
        String text = ReviewHasher.normalize(rawText);
        String hash = ReviewHasher.hash(text, props.model());

        // 1. mémoire
        var hit = memory.getIfPresent(hash);
        if (hit != null) return new Dtos.AnalyzeResponse(hit.label(), hit.score(), true);

        // 2. base de données
        var stored = repo.findByTextHash(hash);
        if (stored.isPresent()) {
            var r = stored.get();
            memory.put(hash, new Dtos.ClassResult(r.getLabel(), r.getScore()));
            return new Dtos.AnalyzeResponse(r.getLabel(), r.getScore(), true);
        }

        // 3. appel API
        var res = client.classify(text);
        Review r = new Review();
        r.setText(text);
        r.setTextHash(hash);
        r.setProduct(blankToNull(product));
        r.setLabel(res.label());
        r.setScore(res.score());
        r.setModel(props.model());
        repo.save(r);
        memory.put(hash, res);
        return new Dtos.AnalyzeResponse(res.label(), res.score(), false);
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.strip();
    }
}
