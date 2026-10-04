package com.shop.sentiment_analysis.notify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shop.sentiment_analysis.auth.JwtService;
import com.shop.sentiment_analysis.auth.Role;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Canal /ws/notifications.
 * Protocole : le client envoie d'abord {"type":"auth","token":"<jwt>"} (le jeton n'apparaît donc pas dans l'URL).
 * Seuls les jetons ADMIN valides sont abonnés ; tout autre premier message ferme la connexion.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationHandler extends TextWebSocketHandler {

    private static final CloseStatus UNAUTHORIZED = CloseStatus.POLICY_VIOLATION.withReason("unauthorized");

    private final JwtDecoder jwtDecoder;
    private final ObjectMapper json;

    /** Sessions admin authentifiées, protégées pour des envois concurrents. */
    private final Map<String, WebSocketSession> admins = new ConcurrentHashMap<>();

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        if (admins.containsKey(session.getId())) return; // seul le message d'authentification est attendu
        try {
            JsonNode msg = json.readTree(message.getPayload());
            if (!"auth".equals(msg.path("type").asText())) throw new JwtException("premier message attendu : auth");
            Jwt jwt = jwtDecoder.decode(msg.path("token").asText());
            if (!Role.ADMIN.name().equals(jwt.getClaimAsString(JwtService.CLAIM_ROLE))) throw new JwtException("rôle ADMIN requis");
            admins.put(session.getId(), new ConcurrentWebSocketSessionDecorator(session, 5_000, 64 * 1024));
            session.sendMessage(new TextMessage("{\"type\":\"ready\"}"));
        } catch (JwtException | IOException e) {
            session.close(UNAUTHORIZED);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        admins.remove(session.getId());
    }

    /** Envoie l'événement à tous les administrateurs connectés (une session en erreur est retirée). */
    public void broadcast(Object event) {
        if (admins.isEmpty()) return;
        TextMessage payload;
        try {
            payload = new TextMessage(json.writeValueAsString(event));
        } catch (IOException e) {
            log.warn("Notification non sérialisable : {}", e.getMessage());
            return;
        }
        admins.values().forEach(s -> {
            try {
                if (s.isOpen()) s.sendMessage(payload);
            } catch (IOException | IllegalStateException e) {
                admins.remove(s.getId());
            }
        });
    }

    int subscribers() { return admins.size(); }
}
