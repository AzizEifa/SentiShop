package com.shop.sentiment_analysis.service;

import com.shop.sentiment_analysis.client.HuggingFaceClient;
import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** Requêtes du back-office (recherche, période, tri) et série temporelle du tableau de bord, sur H2. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:queries-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "app.demo-client.enabled=false"})
class ReviewQueriesTest {

    @Autowired ReviewRepository repo;
    @Autowired DashboardService dashboard;
    @MockBean HuggingFaceClient huggingFace;

    @BeforeEach
    void data() {
        repo.deleteAll();
        save("Livraison rapide, très bon casque", "Casque", SentimentLabel.POSITIVE, 0.95, "Sara Benali", Duration.ZERO);
        save("La batterie ne tient pas", "Casque", SentimentLabel.NEGATIVE, 0.80, null, Duration.ofDays(2));
        save("Produit correct", "Montre", SentimentLabel.NEUTRAL, 0.60, "Karim", Duration.ofDays(40));
    }

    private void save(String text, String product, SentimentLabel label, double score, String author, Duration age) {
        var r = new Review();
        r.setText(text);
        r.setTextHash(Integer.toHexString(text.hashCode()));
        r.setProduct(product);
        r.setLabel(label);
        r.setScore(score);
        r.setAuthorName(author);
        r.setCreatedAt(Instant.now().minus(age));
        repo.save(r);
    }

    @Test
    void rechercheDansLeTexteEtLAuteur() {
        var page = PageRequest.of(0, 10);
        assertThat(repo.filter(null, "", "batterie", Instant.EPOCH, page).getContent())
                .extracting(Review::getText).containsExactly("La batterie ne tient pas");
        assertThat(repo.filter(null, "", "sara", Instant.EPOCH, page).getTotalElements()).isEqualTo(1);
        assertThat(repo.filter(SentimentLabel.NEGATIVE, "casq", "", Instant.EPOCH, page).getTotalElements()).isEqualTo(1);
    }

    @Test
    void filtreParPeriodeEtTrie() {
        var since = Instant.now().minus(Duration.ofDays(7));
        assertThat(repo.filter(null, "", "", since, PageRequest.of(0, 10)).getTotalElements()).isEqualTo(2);
        var byScore = repo.filter(null, "", "", Instant.EPOCH, PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "score")));
        assertThat(byScore.getContent()).extracting(Review::getScore).containsExactly(0.60, 0.80, 0.95);
    }

    @Test
    void serieTemporelleJourParJour() {
        var points = dashboard.trend("", 7);
        assertThat(points).hasSize(7);
        assertThat(points.get(6).date()).isEqualTo(LocalDate.now().toString());
        assertThat(points.stream().mapToLong(p -> p.positive() + p.neutral() + p.negative()).sum()).isEqualTo(2);
        assertThat(points.get(6).positive()).isEqualTo(1);
    }

    @Test
    void statistiquesSurUnePeriode() {
        assertThat(dashboard.stats("", null).total()).isEqualTo(3);
        assertThat(dashboard.stats("", 7).total()).isEqualTo(2);
        assertThat(dashboard.stats("Montre", 7).total()).isZero();
    }
}
