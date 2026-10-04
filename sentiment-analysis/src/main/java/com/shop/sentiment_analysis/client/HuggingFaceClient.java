package com.shop.sentiment_analysis.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.shop.sentiment_analysis.config.HuggingFaceProperties;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.exception.HfUnavailableException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class HuggingFaceClient {

    private final WebClient hf;
    private final HuggingFaceProperties props;

    public Dtos.ClassResult classify(String text) {
        JsonNode root = post(props.model(), Map.of("inputs", text));
        // Format HF : [[{label, score}, ...]] (ou parfois [{...}])
        JsonNode scores = root != null && root.isArray() && root.size() > 0 && root.get(0).isArray() ? root.get(0) : root;
        JsonNode best = null;
        if (scores != null) {
            for (JsonNode n : scores) {
                if (best == null || n.get("score").asDouble() > best.get("score").asDouble()) best = n;
            }
        }
        if (best == null) throw new HfUnavailableException("Réponse vide de l'API IA", 502);
        return new Dtos.ClassResult(SentimentLabel.from(best.get("label").asText()), best.get("score").asDouble());
    }

    public String summarize(String text) {
        JsonNode root = post(props.summaryModel(), Map.of(
                "inputs", text,
                "parameters", Map.of("max_length", 120, "min_length", 30)));
        if (root == null || !root.isArray() || root.isEmpty()) {
            throw new HfUnavailableException("Réponse vide de l'API IA", 502);
        }
        return root.get(0).get("summary_text").asText();
    }

    private JsonNode post(String model, Object body) {
        try {
            return hf.post()
                    // "/" + model en littéral : un {model} en variable d'URI encoderait le "/" en %2F
                    .uri("/" + model)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .retryWhen(Retry.backoff(2, Duration.ofSeconds(2))
                            .filter(e -> e instanceof WebClientResponseException w && w.getStatusCode().value() == 503))
                    .block(props.timeout());
        } catch (Exception e) {
            // Le retry épuisé enveloppe l'erreur d'origine : on remonte la chaîne de causes
            Throwable t = e;
            while (t != null && !(t instanceof WebClientResponseException)) t = t.getCause();
            if (t instanceof WebClientResponseException w) throw map(w);
            throw new HfUnavailableException("API IA injoignable", 502);
        }
    }

    private HfUnavailableException map(WebClientResponseException e) {
        int s = e.getStatusCode().value();
        String msg = switch (s) {
            case 401, 403 -> "Token Hugging Face invalide ou sans droit Inference Providers";
            case 429 -> "Quota Hugging Face dépassé";
            default -> "API IA indisponible (" + s + ")";
        };
        return new HfUnavailableException(msg, s == 429 ? 429 : 502);
    }
}
