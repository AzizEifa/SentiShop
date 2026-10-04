package com.shop.sentiment_analysis.service;

import com.shop.sentiment_analysis.cache.ReviewHasher;
import com.shop.sentiment_analysis.client.HuggingFaceClient;
import com.shop.sentiment_analysis.config.HuggingFaceProperties;
import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.domain.ReviewAnalysis;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.exception.HfUnavailableException;
import com.shop.sentiment_analysis.repository.ReviewAnalysisRepository;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Équivalent de test_api_client.py : analyse + cache, sans appeler la vraie API. */
@ExtendWith(MockitoExtension.class)
class SentimentServiceTest {

    private static final String MODEL = "cardiffnlp/twitter-xlm-roberta-base-sentiment";

    @Mock HuggingFaceClient client;
    @Mock ReviewRepository repo;
    @Mock ReviewAnalysisRepository analyses;
    SentimentService service;

    @BeforeEach
    void setUp() {
        var props = new HuggingFaceProperties("http://hf.test", "test-token", MODEL, "facebook/bart-large-cnn", Duration.ofSeconds(5));
        service = new SentimentService(client, repo, analyses, props);
    }

    @Test
    void premierAppel_appelleHuggingFace_metEnCache_etEnregistreLAvis() {
        when(analyses.findByTextHash(anyString())).thenReturn(Optional.empty());
        when(client.classify("Super produit")).thenReturn(new Dtos.ClassResult(SentimentLabel.POSITIVE, 0.93));

        var res = service.analyze("  Super   produit ", "Casque");

        assertThat(res).isEqualTo(new Dtos.AnalyzeResponse(SentimentLabel.POSITIVE, 0.93, false));
        var analysis = ArgumentCaptor.forClass(ReviewAnalysis.class);
        verify(analyses).save(analysis.capture());
        assertThat(analysis.getValue().getTextHash()).isEqualTo(ReviewHasher.hash("Super produit", MODEL));
        assertThat(analysis.getValue().getLabel()).isEqualTo(SentimentLabel.POSITIVE);

        var review = ArgumentCaptor.forClass(Review.class);
        verify(repo).save(review.capture());
        assertThat(review.getValue().getText()).isEqualTo("Super produit");
        assertThat(review.getValue().getProduct()).isEqualTo("Casque");
        assertThat(review.getValue().getModel()).isEqualTo(MODEL);
    }

    @Test
    void secondAppelIdentique_nAppellePasHuggingFace_cachedTrue() {
        when(analyses.findByTextHash(anyString())).thenReturn(Optional.empty());
        when(client.classify(anyString())).thenReturn(new Dtos.ClassResult(SentimentLabel.NEGATIVE, 0.8));

        var first = service.analyze("Livraison en retard", null);
        var second = service.analyze("Livraison   en retard  ", null); // mêmes mots, espaces différents

        assertThat(first.cached()).isFalse();
        assertThat(second).isEqualTo(new Dtos.AnalyzeResponse(SentimentLabel.NEGATIVE, 0.8, true));
        verify(client, times(1)).classify(anyString());
        verify(analyses, times(1)).findByTextHash(anyString()); // 2e appel servi par Caffeine
    }

    @Test
    void avisIdentiques_comptentChacun_maisUnSeulAppelAPI() {
        when(analyses.findByTextHash(anyString())).thenReturn(Optional.empty());
        when(client.classify(anyString())).thenReturn(new Dtos.ClassResult(SentimentLabel.POSITIVE, 0.9));

        service.analyze("Très bien", "Casque");
        service.analyze("Très bien", "Montre");
        service.analyze("Très bien", "Casque");

        verify(client, times(1)).classify(anyString());
        verify(analyses, times(1)).save(any(ReviewAnalysis.class));
        var reviews = ArgumentCaptor.forClass(Review.class);
        verify(repo, times(3)).save(reviews.capture());
        assertThat(reviews.getAllValues()).extracting(Review::getProduct).containsExactly("Casque", "Montre", "Casque");
    }

    @Test
    void analyseDejaEnBase_nAppellePasHuggingFace() {
        var stored = new ReviewAnalysis();
        stored.setLabel(SentimentLabel.NEUTRAL);
        stored.setScore(0.61);
        when(analyses.findByTextHash(ReviewHasher.hash("C'est correct", MODEL))).thenReturn(Optional.of(stored));

        var res = service.analyze("C'est correct", null);

        assertThat(res).isEqualTo(new Dtos.AnalyzeResponse(SentimentLabel.NEUTRAL, 0.61, true));
        verifyNoInteractions(client);
        verify(analyses, never()).save(any());
        verify(repo).save(any(Review.class)); // l'avis est quand même compté
    }

    @Test
    void textesDifferents_deuxAppels() {
        when(analyses.findByTextHash(anyString())).thenReturn(Optional.empty());
        when(client.classify(anyString())).thenReturn(new Dtos.ClassResult(SentimentLabel.POSITIVE, 0.9));

        service.analyze("المنتج رائع", null);
        service.analyze("Great product", null);

        verify(client, times(2)).classify(anyString());
    }

    @Test
    void erreurHuggingFace_rienNEstEnregistre_etOnReessaieEnsuite() {
        when(analyses.findByTextHash(anyString())).thenReturn(Optional.empty());
        when(client.classify(anyString()))
                .thenThrow(new HfUnavailableException("Quota Hugging Face dépassé", 429))
                .thenReturn(new Dtos.ClassResult(SentimentLabel.POSITIVE, 0.7));

        assertThatThrownBy(() -> service.analyze("Top", null))
                .isInstanceOf(HfUnavailableException.class)
                .hasMessageContaining("Quota");
        verify(repo, never()).save(any());
        verify(analyses, never()).save(any());

        assertThat(service.analyze("Top", null).cached()).isFalse();
        verify(client, times(2)).classify(anyString());
    }

    @Test
    void analyseConcurrente_dejaEnregistree_nEmpechePasDeCompterLAvis() {
        when(analyses.findByTextHash(anyString())).thenReturn(Optional.empty());
        when(client.classify(anyString())).thenReturn(new Dtos.ClassResult(SentimentLabel.POSITIVE, 0.9));
        when(analyses.save(any())).thenThrow(new DataIntegrityViolationException("duplicate text_hash"));

        assertThat(service.analyze("Top", null).label()).isEqualTo(SentimentLabel.POSITIVE);
        verify(repo).save(any(Review.class));
    }

    @Test
    void produitTropLong_estTronque() {
        when(analyses.findByTextHash(anyString())).thenReturn(Optional.empty());
        when(client.classify(anyString())).thenReturn(new Dtos.ClassResult(SentimentLabel.POSITIVE, 0.9));

        service.analyze("Top", "p".repeat(200));

        var review = ArgumentCaptor.forClass(Review.class);
        verify(repo).save(review.capture());
        assertThat(review.getValue().getProduct()).hasSize(120);
    }
}
