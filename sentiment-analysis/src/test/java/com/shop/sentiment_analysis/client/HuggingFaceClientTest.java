package com.shop.sentiment_analysis.client;

import com.shop.sentiment_analysis.config.HuggingFaceProperties;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.exception.HfUnavailableException;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Client HF testé contre un faux serveur HTTP (MockWebServer) : aucun crédit consommé. */
class HuggingFaceClientTest {

    private MockWebServer server;
    private HuggingFaceClient client;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        var props = new HuggingFaceProperties(server.url("/models").toString(), "test-token",
                "cardiffnlp/twitter-xlm-roberta-base-sentiment", "facebook/bart-large-cnn", Duration.ofSeconds(30));
        // même construction que le bean hfWebClient de AppConfig
        var web = WebClient.builder()
                .baseUrl(props.baseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + props.token())
                .build();
        client = new HuggingFaceClient(web, props);
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    private static MockResponse json(int status, String body) {
        return new MockResponse().setResponseCode(status).setHeader("Content-Type", "application/json").setBody(body);
    }

    @Test
    void classify_choisitLeScoreMax_etEnvoieLeToken() throws Exception {
        server.enqueue(json(200, """
                [[{"label":"negative","score":0.05},{"label":"neutral","score":0.15},{"label":"positive","score":0.80}]]"""));

        var res = client.classify("J'adore ce produit");

        assertThat(res.label()).isEqualTo(SentimentLabel.POSITIVE);
        assertThat(res.score()).isEqualTo(0.80);
        RecordedRequest req = server.takeRequest();
        assertThat(req.getPath()).isEqualTo("/models/cardiffnlp/twitter-xlm-roberta-base-sentiment");
        assertThat(req.getHeader("Authorization")).isEqualTo("Bearer test-token");
        assertThat(req.getBody().readUtf8()).contains("\"inputs\":\"J'adore ce produit\"");
    }

    @Test
    void classify_comprendLesLabels_LABEL_x() {
        server.enqueue(json(200, "[[{\"label\":\"LABEL_0\",\"score\":0.9},{\"label\":\"LABEL_2\",\"score\":0.1}]]"));
        assertThat(client.classify("سيء").label()).isEqualTo(SentimentLabel.NEGATIVE);
    }

    @Test
    void erreur401_messageTokenLisible() {
        server.enqueue(json(401, "{\"error\":\"Invalid credentials\"}"));
        assertThatThrownBy(() -> client.classify("x"))
                .isInstanceOf(HfUnavailableException.class)
                .hasMessageContaining("Token")
                .extracting(e -> ((HfUnavailableException) e).getStatus()).isEqualTo(502);
    }

    @Test
    void erreur429_traduiteEnQuota() {
        server.enqueue(json(429, "{\"error\":\"rate limit\"}"));
        assertThatThrownBy(() -> client.classify("x"))
                .hasMessageContaining("Quota")
                .extracting(e -> ((HfUnavailableException) e).getStatus()).isEqualTo(429);
    }

    @Test
    void erreur503_modeleEnChargement_retryPuisSucces() {
        server.enqueue(json(503, "{\"error\":\"Model is currently loading\"}"));
        server.enqueue(json(200, "[[{\"label\":\"neutral\",\"score\":0.7}]]"));

        assertThat(client.classify("Bof").label()).isEqualTo(SentimentLabel.NEUTRAL);
        assertThat(server.getRequestCount()).isEqualTo(2);
    }

    @Test
    void reponseVide_erreur502() {
        server.enqueue(json(200, "[]"));
        assertThatThrownBy(() -> client.classify("x"))
                .isInstanceOf(HfUnavailableException.class)
                .extracting(e -> ((HfUnavailableException) e).getStatus()).isEqualTo(502);
    }

    @Test
    void summarize_renvoieLeResume() throws Exception {
        server.enqueue(json(200, "[{\"summary_text\":\"Customers complain about late delivery.\"}]"));

        assertThat(client.summarize("Late delivery. Broken box.")).isEqualTo("Customers complain about late delivery.");
        RecordedRequest req = server.takeRequest();
        assertThat(req.getPath()).isEqualTo("/models/facebook/bart-large-cnn");
        assertThat(req.getBody().readUtf8()).contains("max_length");
    }
}
