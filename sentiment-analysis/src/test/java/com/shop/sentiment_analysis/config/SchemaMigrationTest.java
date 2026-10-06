package com.shop.sentiment_analysis.config;

import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.repository.ReviewAnalysisRepository;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import com.shop.sentiment_analysis.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.test.mock.mockito.MockBean;

import static org.assertj.core.api.Assertions.assertThat;

/** Base « ancienne version » (review.text_hash UNIQUE, déjà des avis) → migration → doublons acceptés. */
@DataJpaTest
@Import({SchemaMigration.class, DashboardService.class})
class SchemaMigrationTest {

    @Autowired JdbcTemplate jdbc;
    @Autowired SchemaMigration migration;
    @Autowired ReviewAnalysisRepository analyses;
    @Autowired ReviewRepository reviews;
    @Autowired DashboardService dashboard;
    @MockBean com.shop.sentiment_analysis.client.HuggingFaceClient client;

    private void insertReview(String hash, String product) {
        jdbc.update("insert into review (text, text_hash, product, label, score, model, created_at) "
                + "values ('Très bien', ?, ?, 'POSITIVE', 0.9, 'm', current_timestamp)", hash, product);
    }

    @Test
    void ancienneBase_migree_puisDoublonsAcceptes_etComptes() {
        jdbc.execute("alter table review add constraint uk_old_text_hash unique (text_hash)");
        insertReview("h1", "Casque");

        migration.run(null);

        assertThat(analyses.findByTextHash("h1")).get()
                .satisfies(a -> assertThat(a.getLabel()).isEqualTo(SentimentLabel.POSITIVE));
        insertReview("h1", "Montre"); // aurait échoué avant la migration
        assertThat(reviews.count()).isEqualTo(2);
        assertThat(dashboard.stats(null, null).positive()).isEqualTo(2);
    }

    @Test
    void baseNeuve_ouDejaMigree_aucunEffet() {
        // (un ALTER TABLE valide la transaction sous H2 : on compare avant / après plutôt qu'à zéro)
        long before = analyses.count();
        migration.run(null);
        migration.run(null);
        assertThat(analyses.count()).isEqualTo(before);
    }
}
