package com.shop.sentiment_analysis.notify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.shop.sentiment_analysis.auth.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class NotificationHandlerTest {

    JwtDecoder decoder = mock(JwtDecoder.class);
    NotificationHandler handler;

    @BeforeEach
    void setUp() {
        handler = new NotificationHandler(decoder, new ObjectMapper().registerModule(new JavaTimeModule()));
        when(decoder.decode("admin-token")).thenReturn(jwt("ADMIN"));
        when(decoder.decode("client-token")).thenReturn(jwt("CLIENT"));
        when(decoder.decode("bad-token")).thenThrow(new JwtException("invalid"));
    }

    private static Jwt jwt(String role) {
        return new Jwt("t", Instant.now(), Instant.now().plusSeconds(60), Map.of("alg", "HS256"),
                Map.of(JwtService.CLAIM_ROLE, role, "sub", "x"));
    }

    private WebSocketSession session(String id) {
        WebSocketSession s = mock(WebSocketSession.class);
        when(s.getId()).thenReturn(id);
        when(s.isOpen()).thenReturn(true);
        return s;
    }

    private static TextMessage auth(String token) {
        return new TextMessage("{\"type\":\"auth\",\"token\":\"" + token + "\"}");
    }

    @Test
    void admin_estAbonne_etRecoitLesAvis() throws Exception {
        WebSocketSession admin = session("a");
        handler.handleTextMessage(admin, auth("admin-token"));

        handler.broadcast(ReviewEvent.deleted(1L));

        verify(admin).sendMessage(new TextMessage("{\"type\":\"ready\"}"));
        verify(admin, times(2)).sendMessage(any());
        assertThat(handler.subscribers()).isEqualTo(1);
    }

    @Test
    void client_ouJetonInvalide_connexionFermee_etRienRecu() throws Exception {
        WebSocketSession client = session("c");
        WebSocketSession anonymous = session("x");
        handler.handleTextMessage(client, auth("client-token"));
        handler.handleTextMessage(anonymous, auth("bad-token"));

        handler.broadcast(ReviewEvent.deleted(1L));

        verify(client).close(any(CloseStatus.class));
        verify(anonymous).close(any(CloseStatus.class));
        verify(client, never()).sendMessage(any());
        assertThat(handler.subscribers()).isZero();
    }

    @Test
    void deconnexion_retireLAbonnement() throws Exception {
        WebSocketSession admin = session("a");
        handler.handleTextMessage(admin, auth("admin-token"));
        handler.afterConnectionClosed(admin, CloseStatus.NORMAL);
        assertThat(handler.subscribers()).isZero();
    }
}
