package com.shop.sentiment_analysis.compare;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.shop.sentiment_analysis.cache.ReviewHasher;
import com.shop.sentiment_analysis.client.HuggingFaceClient;
import com.shop.sentiment_analysis.config.HuggingFaceProperties;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.repository.ReviewAnalysisRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

/**
 * B3 : analyse le même texte avec le modèle multilingue (XLM-RoBERTa) et avec un modèle anglais seul.
 * Réutilise HuggingFaceClient (retry, erreurs, parsing) sans le modifier : on crée simplement
 * une seconde instance qui pointe vers le modèle anglais.
 * Les comparaisons ne sont pas enregistrées comme avis (le tableau de bord n'est pas affecté),
 * mais elles sont mises en cache pour ne pas consommer de crédits deux fois.
 */
@Service
public class CompareService {

    static final String DEFAULT_ENGLISH_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest";

    private final HuggingFaceClient multilingualClient;
    private final HuggingFaceClient englishClient;
    private final ReviewAnalysisRepository analyses;
    private final String multilingualModel;
    private final String englishModel;

    private final Cache<String, Dtos.ClassResult> memory = Caffeine.newBuilder()
            .maximumSize(5_000)
            .expireAfterWrite(Duration.ofDays(7))
            .build();

    @Autowired
    public CompareService(HuggingFaceClient multilingualClient, WebClient hfWebClient, HuggingFaceProperties props,
                          ReviewAnalysisRepository analyses,
                          @Value("${huggingface.english-model:" + DEFAULT_ENGLISH_MODEL + "}") String englishModel) {
        this(multilingualClient,
                new HuggingFaceClient(hfWebClient, new HuggingFaceProperties(
                        props.baseUrl(), props.token(), englishModel, props.summaryModel(), props.timeout())),
                analyses, props.model(), englishModel);
    }

    CompareService(HuggingFaceClient multilingualClient, HuggingFaceClient englishClient, ReviewAnalysisRepository analyses,
                   String multilingualModel, String englishModel) {
        this.multilingualClient = multilingualClient;
        this.englishClient = englishClient;
        this.analyses = analyses;
        this.multilingualModel = multilingualModel;
        this.englishModel = englishModel;
    }

    public CompareDtos.CompareResponse compare(String rawText) {
        String text = ReviewHasher.normalize(rawText);
        var multi = classify(text, multilingualModel, multilingualClient, true);
        var english = classify(text, englishModel, englishClient, false);
        return new CompareDtos.CompareResponse(multi, english, multi.label() == english.label());
    }

    private CompareDtos.ModelResult classify(String text, String model, HuggingFaceClient client, boolean lookupReviews) {
        String hash = ReviewHasher.hash(text, model);

        var hit = memory.getIfPresent(hash);
        if (hit != null) return new CompareDtos.ModelResult(model, hit.label(), hit.score(), true);

        // Pour le modèle multilingue, un avis déjà analysé (cache review_analysis) évite aussi l'appel API
        if (lookupReviews) {
            var stored = analyses.findByTextHash(hash);
            if (stored.isPresent()) {
                var r = stored.get();
                memory.put(hash, new Dtos.ClassResult(r.getLabel(), r.getScore()));
                return new CompareDtos.ModelResult(model, r.getLabel(), r.getScore(), true);
            }
        }

        var res = client.classify(text);
        memory.put(hash, res);
        return new CompareDtos.ModelResult(model, res.label(), res.score(), false);
    }
}
