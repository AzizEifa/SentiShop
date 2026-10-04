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
import java.util.ArrayList;
import java.util.List;

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

    /** Résultat d'une analyse de texte (normalisé), avec son empreinte de cache. */
    public record TextAnalysis(String text, String hash, Dtos.ClassResult result, boolean cached) {}

    /** Analyse (avec cache) puis enregistre l'avis, éventuellement rattaché au client qui l'a déposé. */
    public Submission record(String rawText, String product, Long authorId, String authorName, Integer rating) {
        return record(rawText, product, authorId, authorName, rating, List.of());
    }

    public Submission record(String rawText, String product, Long authorId, String authorName, Integer rating, List<String> images) {
        TextAnalysis a = analyzeText(rawText);
        // l'avis lui-même est toujours enregistré : 30 clients qui écrivent « Très bien » = 30 avis
        Review r = new Review();
        apply(r, a);
        r.setProduct(cleanProduct(product));
        r.setAuthorId(authorId);
        r.setAuthorName(authorName);
        r.setRating(rating);
        r.setImages(new ArrayList<>(images));
        repo.save(r);
        return new Submission(r, a.cached());
    }

    /** Texte modifié par son auteur : nouvelle analyse (le cache évite un appel si le texte est déjà connu). */
    public Submission reanalyze(Review r, String rawText) {
        TextAnalysis a = analyzeText(rawText);
        apply(r, a);
        return new Submission(r, a.cached());
    }

    /** Cache à 2 niveaux puis, en dernier recours, appel à Hugging Face. */
    public TextAnalysis analyzeText(String rawText) {
        String text = ReviewHasher.normalize(rawText);
        String hash = ReviewHasher.hash(text, props.model());

        boolean cached = true;
        // 1. mémoire
        var res = memory.getIfPresent(hash);
        if (res == null) {
            // 2. base de données (cache persistant)
            res = analyses.findByTextHash(hash)
                    .map(x -> new Dtos.ClassResult(x.getLabel(), x.getScore()))
                    .orElse(null);
            if (res == null) {
                // 3. appel API
                res = client.classify(text);
                saveAnalysis(hash, res);
                cached = false;
            }
            memory.put(hash, res);
        }
        return new TextAnalysis(text, hash, res, cached);
    }

    private void apply(Review r, TextAnalysis a) {
        r.setText(a.text());
        r.setTextHash(a.hash());
        r.setLabel(a.result().label());
        r.setScore(a.result().score());
        r.setModel(props.model());
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
