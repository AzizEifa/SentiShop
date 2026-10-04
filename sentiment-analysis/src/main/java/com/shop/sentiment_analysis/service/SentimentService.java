package com.shop.sentiment_analysis.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.shop.sentiment_analysis.cache.ReviewHasher;
import com.shop.sentiment_analysis.client.HuggingFaceClient;
import com.shop.sentiment_analysis.config.HuggingFaceProperties;
import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.domain.ReviewAnalysis;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.repository.ReviewAnalysisRepository;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Cache à 2 niveaux : Caffeine (mémoire) puis table review_analysis.
 * L'API Hugging Face n'est appelée qu'en cas d'échec des deux.
 * Chaque avis reçu est ensuite enregistré dans review (doublons compris), pour des statistiques justes.
 * Pas de @Transactional : on ne garde pas de connexion BDD ouverte pendant l'appel HTTP.
 */
@Service
@RequiredArgsConstructor
public class SentimentService {

    private static final int MAX_PRODUCT = 120;

    private final HuggingFaceClient client;
    private final ReviewRepository repo;
    private final ReviewAnalysisRepository analyses;
    private final HuggingFaceProperties props;

    private final Cache<String, Dtos.ClassResult> memory = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofDays(7))
            .build();

    /** Résultat d'un enregistrement : l'avis sauvegardé et s'il a été servi par le cache. */
    public record Submission(Review review, boolean cached) {}

    public Dtos.AnalyzeResponse analyze(String rawText, String product) {
        var s = record(rawText, product, null, null, null);
        return new Dtos.AnalyzeResponse(s.review().getLabel(), s.review().getScore(), s.cached());
    }

    /** Analyse (avec cache) puis enregistre l'avis, éventuellement rattaché au client qui l'a déposé. */
    public Submission record(String rawText, String product, Long authorId, String authorName, Integer rating) {
        String text = ReviewHasher.normalize(rawText);
        String hash = ReviewHasher.hash(text, props.model());

        boolean cached = true;
        // 1. mémoire
        var res = memory.getIfPresent(hash);
        if (res == null) {
            // 2. base de données (cache persistant)
            res = analyses.findByTextHash(hash)
                    .map(a -> new Dtos.ClassResult(a.getLabel(), a.getScore()))
                    .orElse(null);
            if (res == null) {
                // 3. appel API
                res = client.classify(text);
                saveAnalysis(hash, res);
                cached = false;
            }
            memory.put(hash, res);
        }

        // 4. l'avis lui-même est toujours enregistré : 30 clients qui écrivent « Très bien » = 30 avis
        Review r = new Review();
        r.setText(text);
        r.setTextHash(hash);
        r.setProduct(cleanProduct(product));
        r.setLabel(res.label());
        r.setScore(res.score());
        r.setModel(props.model());
        r.setAuthorId(authorId);
        r.setAuthorName(authorName);
        r.setRating(rating);
        repo.save(r);
        return new Submission(r, cached);
    }

    private void saveAnalysis(String hash, Dtos.ClassResult res) {
        ReviewAnalysis a = new ReviewAnalysis();
        a.setTextHash(hash);
        a.setLabel(res.label());
        a.setScore(res.score());
        a.setModel(props.model());
        try {
            analyses.save(a);
        } catch (DataIntegrityViolationException e) {
            // même texte analysé en parallèle par une autre requête : l'analyse est déjà en cache
        }
    }

    private static String cleanProduct(String s) {
        if (s == null || s.isBlank()) return null;
        String p = s.strip();
        return p.length() > MAX_PRODUCT ? p.substring(0, MAX_PRODUCT) : p; // évite l'échec SQL varchar(120)
    }
}
