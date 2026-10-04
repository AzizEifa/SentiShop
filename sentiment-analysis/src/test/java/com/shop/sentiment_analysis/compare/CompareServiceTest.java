package com.shop.sentiment_analysis.compare;

import com.shop.sentiment_analysis.cache.ReviewHasher;
import com.shop.sentiment_analysis.client.HuggingFaceClient;
import com.shop.sentiment_analysis.domain.ReviewAnalysis;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.repository.ReviewAnalysisRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CompareServiceTest {

    private static final String MULTI = "cardiffnlp/twitter-xlm-roberta-base-sentiment";
    private static final String EN = CompareService.DEFAULT_ENGLISH_MODEL;

    @Mock HuggingFaceClient multilingual;
    @Mock HuggingFaceClient english;
    @Mock ReviewAnalysisRepository repo;
    CompareService service;

    @BeforeEach
    void setUp() {
        service = new CompareService(multilingual, english, repo, MULTI, EN);
    }

    @Test
    void appelleLesDeuxModeles_etDetecteLeDesaccord() {
        when(repo.findByTextHash(anyString())).thenReturn(Optional.empty());
        when(multilingual.classify("المنتج رائع")).thenReturn(new Dtos.ClassResult(SentimentLabel.POSITIVE, 0.9));
        when(english.classify("المنتج رائع")).thenReturn(new Dtos.ClassResult(SentimentLabel.NEUTRAL, 0.5));

        var res = service.compare(" المنتج   رائع ");

        assertThat(res.multilingual()).isEqualTo(new CompareDtos.ModelResult(MULTI, SentimentLabel.POSITIVE, 0.9, false));
        assertThat(res.english()).isEqualTo(new CompareDtos.ModelResult(EN, SentimentLabel.NEUTRAL, 0.5, false));
        assertThat(res.agree()).isFalse();
        verify(repo, never()).save(any()); // une comparaison n'est pas un avis client
    }

    @Test
    void secondeComparaison_serviePArLeCache() {
        when(repo.findByTextHash(anyString())).thenReturn(Optional.empty());
        when(multilingual.classify(anyString())).thenReturn(new Dtos.ClassResult(SentimentLabel.NEGATIVE, 0.8));
        when(english.classify(anyString())).thenReturn(new Dtos.ClassResult(SentimentLabel.NEGATIVE, 0.7));

        service.compare("Terrible");
        var second = service.compare("Terrible");

        assertThat(second.agree()).isTrue();
        assertThat(second.multilingual().cached()).isTrue();
        assertThat(second.english().cached()).isTrue();
        verify(multilingual, times(1)).classify(anyString());
        verify(english, times(1)).classify(anyString());
    }

    @Test
    void avisDejaAnalyse_reutiliseLaBase_pourLeModeleMultilingue() {
        var stored = new ReviewAnalysis();
        stored.setLabel(SentimentLabel.POSITIVE);
        stored.setScore(0.95);
        when(repo.findByTextHash(ReviewHasher.hash("Super", MULTI))).thenReturn(Optional.of(stored));
        when(english.classify("Super")).thenReturn(new Dtos.ClassResult(SentimentLabel.POSITIVE, 0.9));

        var res = service.compare("Super");

        assertThat(res.multilingual().cached()).isTrue();
        verifyNoInteractions(multilingual);
    }
}
