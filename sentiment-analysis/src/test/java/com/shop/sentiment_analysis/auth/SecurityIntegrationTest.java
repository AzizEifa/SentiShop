package com.shop.sentiment_analysis.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shop.sentiment_analysis.client.HuggingFaceClient;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.exception.HfUnavailableException;
import com.shop.sentiment_analysis.notify.NotificationHandler;
import com.shop.sentiment_analysis.notify.ReviewEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Droits d'accès de bout en bout : vraie configuration Spring Security, base H2 en mémoire, IA simulée. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:security-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "app.demo-client.enabled=false"})
@AutoConfigureMockMvc
class SecurityIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean HuggingFaceClient huggingFace;
    @SpyBean NotificationHandler notifications;

    @Autowired com.shop.sentiment_analysis.product.ProductRepository catalog;

    @BeforeEach
    void ia() {
        when(huggingFace.classify(anyString())).thenReturn(new Dtos.ClassResult(SentimentLabel.POSITIVE, 0.9));
        for (String p : new String[]{"Casque Bluetooth", "Casque"}) {
            if (!catalog.existsByNameIgnoreCase(p)) catalog.save(new com.shop.sentiment_analysis.product.Product(p));
        }
    }

    // ---------- outils ----------
    private String uniqueEmail() { return "client-" + UUID.randomUUID() + "@test.local"; }

    private ResultActions post(String url, String token, Object body) throws Exception {
        var req = MockMvcRequestBuilders.post(url).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (token != null) req.header("Authorization", "Bearer " + token);
        return mvc.perform(req);
    }

    /** Dépôt d'avis client : multipart, partie "review" en JSON. */
    private ResultActions submit(String token, Submit body) throws Exception {
        var part = new org.springframework.mock.web.MockMultipartFile("review", "", "application/json", json.writeValueAsBytes(body));
        var req = MockMvcRequestBuilders.multipart("/api/me/reviews").file(part);
        if (token != null) req.header("Authorization", "Bearer " + token);
        return mvc.perform(req);
    }

    private ResultActions get(String url, String token) throws Exception {
        var req = MockMvcRequestBuilders.get(url);
        if (token != null) req.header("Authorization", "Bearer " + token);
        return mvc.perform(req);
    }

    private String token(ResultActions r) throws Exception {
        JsonNode body = json.readTree(r.andReturn().getResponse().getContentAsString());
        return body.path("token").asText();
    }

    private String registerClient(String email) throws Exception {
        return token(post("/api/auth/register", null, new AuthDtos.RegisterRequest("Sara Benali", email, "Secret123")).andExpect(status().isCreated()));
    }

    private String adminToken() throws Exception {
        return token(post("/api/auth/login", null, new AuthDtos.LoginRequest("admin@sentishop.local", "Admin123!")).andExpect(status().isOk()));
    }

    private record Submit(String product, Integer rating, String text) {}

    // ---------- inscription / connexion ----------
    @Test
    void inscription_creeUnClient_etRenvoieUnJeton() throws Exception {
        String email = uniqueEmail();
        post("/api/auth/register", null, new AuthDtos.RegisterRequest("Sara Benali", email.toUpperCase(), "Secret123"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.role").value("CLIENT"))
                .andExpect(jsonPath("$.user.email").value(email))          // email normalisé en minuscules
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist()); // jamais exposé
    }

    @Test
    void inscription_neCreeJamaisDAdmin_memeSiOnLeDemande() throws Exception {
        String body = "{\"fullName\":\"Pirate\",\"email\":\"" + uniqueEmail() + "\",\"password\":\"Secret123\",\"role\":\"ADMIN\"}";
        mvc.perform(MockMvcRequestBuilders.post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.role").value("CLIENT"));
    }

    @Test
    void inscription_emailDejaUtilise_409() throws Exception {
        String email = uniqueEmail();
        registerClient(email);
        post("/api/auth/register", null, new AuthDtos.RegisterRequest("Autre", email, "Secret123"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Un compte existe déjà avec cet email."));
    }

    @Test
    void inscription_invalide_400_avecErreurParChamp() throws Exception {
        post("/api/auth/register", null, new AuthDtos.RegisterRequest("S", "pas-un-email", "court"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.email").value("Adresse email invalide"))
                .andExpect(jsonPath("$.errors.fullName").exists())
                .andExpect(jsonPath("$.errors.password").exists());
    }

    @Test
    void connexion_mauvaisMotDePasse_401_messageGenerique() throws Exception {
        post("/api/auth/login", null, new AuthDtos.LoginRequest("admin@sentishop.local", "faux"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value(AuthService.BAD_CREDENTIALS));
        post("/api/auth/login", null, new AuthDtos.LoginRequest("inconnu@test.local", "faux"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value(AuthService.BAD_CREDENTIALS));
    }

    @Test
    void me_renvoieLeProfilDuJeton() throws Exception {
        get("/api/auth/me", adminToken()).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("ADMIN"));
    }

    // ---------- droits ----------
    @Test
    void sansJeton_401_avecMessage() throws Exception {
        get("/api/dashboard/stats", null)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Session expirée ou absente : veuillez vous connecter."));
        get("/api/me/reviews", null).andExpect(status().isUnauthorized());
    }

    @Test
    void jetonFalsifie_401() throws Exception {
        get("/api/dashboard/stats", "abc.def.ghi").andExpect(status().isUnauthorized());
    }

    @Test
    void client_nAccedePasAuBackOffice_403() throws Exception {
        String client = registerClient(uniqueEmail());
        get("/api/dashboard/stats", client).andExpect(status().isForbidden());
        get("/api/reviews", client).andExpect(status().isForbidden());
        get("/api/reviews/export", client).andExpect(status().isForbidden());
        get("/api/admin/users", client).andExpect(status().isForbidden());
        post("/api/reviews/analyze", client, new Dtos.AnalyzeRequest("test", null)).andExpect(status().isForbidden());
    }

    @Test
    void admin_accedeAuBackOffice_maisNeDeposePasDAvisClient() throws Exception {
        String admin = adminToken();
        get("/api/dashboard/stats", admin).andExpect(status().isOk());
        get("/api/admin/users", admin).andExpect(status().isOk());
        submit(admin, new Submit("Casque", 5, "Excellent produit, je recommande")).andExpect(status().isForbidden());
    }

    @Test
    void santeEtProduits_accessibles() throws Exception {
        get("/actuator/health", null).andExpect(status().isOk());
        get("/api/products", registerClient(uniqueEmail())).andExpect(status().isOk());
    }

    // ---------- avis client + notification ----------
    @Test
    void client_deposeUnAvis_quiEstAnalyse_rattache_etNotifie() throws Exception {
        String email = uniqueEmail();
        String client = registerClient(email);

        submit(client, new Submit("Casque Bluetooth", 5, "Son excellent, livraison rapide !"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.product").value("Casque Bluetooth"))
                .andExpect(jsonPath("$.rating").value(5))
                .andExpect(jsonPath("$.label").doesNotExist()); // le sentiment reste interne

        get("/api/me/reviews", client).andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1));
        get("/api/me/reviews", registerClient(uniqueEmail())).andExpect(jsonPath("$.content.length()").value(0)); // pas ceux des autres

        var event = ArgumentCaptor.forClass(Object.class);
        verify(notifications, atLeastOnce()).broadcast(event.capture());
        ReviewEvent e = (ReviewEvent) event.getValue();
        assertThat(e.type()).isEqualTo("review.created");
        assertThat(e.authorName()).isEqualTo("Sara Benali");
        assertThat(e.label()).isEqualTo(SentimentLabel.POSITIVE);

        // l'admin voit l'auteur et la note dans la liste
        get("/api/reviews?size=50", adminToken())
                .andExpect(jsonPath("$.content[?(@.authorName == 'Sara Benali' && @.rating == 5)]").exists());
    }

    @Test
    void avisClient_invalide_400() throws Exception {
        submit(registerClient(uniqueEmail()), new Submit("", 6, "court"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.rating").value("La note va de 1 à 5 étoiles"))
                .andExpect(jsonPath("$.errors.product").exists())
                .andExpect(jsonPath("$.errors.text").exists());
    }

    @Test
    void iaIndisponible_messageAdapteAuClient_etAucuneNotification() throws Exception {
        when(huggingFace.classify(anyString())).thenThrow(new HfUnavailableException("Quota Hugging Face dépassé", 429));
        clearInvocations(notifications);
        submit(registerClient(uniqueEmail()), new Submit("Casque", 4, "Très bon rapport qualité prix"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.detail").value("Votre avis n'a pas pu être enregistré pour le moment. Réessayez dans quelques instants."));
        verify(notifications, never()).broadcast(any());
    }
}
