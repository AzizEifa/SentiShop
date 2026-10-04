package com.shop.sentiment_analysis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shop.sentiment_analysis.auth.AuthDtos;
import com.shop.sentiment_analysis.client.HuggingFaceClient;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.dto.Dtos;
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
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Produits, gestion des avis (client et admin), photos, émojis, profils : base H2 en mémoire, IA simulée. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:features-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "app.demo-client.enabled=false",
        "app.uploads.dir=target/test-uploads"})
@AutoConfigureMockMvc
class FeaturesIntegrationTest {

    /** Vrais en-têtes PNG / JPEG : le serveur vérifie le contenu, pas l'extension. */
    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
    static final byte[] JPG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0, 1};

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean HuggingFaceClient huggingFace;
    @SpyBean NotificationHandler notifications;

    String admin;

    @BeforeEach
    void setUp() throws Exception {
        when(huggingFace.classify(anyString())).thenReturn(new Dtos.ClassResult(SentimentLabel.POSITIVE, 0.9));
        admin = token(send(MockMvcRequestBuilders.post("/api/auth/login"), null,
                new AuthDtos.LoginRequest("admin@sentishop.local", "Admin123!")).andExpect(status().isOk()));
    }

    // ---------- outils ----------
    private ResultActions send(MockHttpServletRequestBuilder req, String token, Object body) throws Exception {
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (token != null) req.header("Authorization", "Bearer " + token);
        return mvc.perform(req);
    }

    private ResultActions multipart(HttpMethod method, String url, String token, String partName, Object body, MockMultipartFile... files) throws Exception {
        MockMultipartHttpServletRequestBuilder req = MockMvcRequestBuilders.multipart(method, url);
        req.file(new MockMultipartFile(partName, "", "application/json", json.writeValueAsBytes(body)));
        for (MockMultipartFile f : files) req.file(f);
        if (token != null) req.header("Authorization", "Bearer " + token);
        return mvc.perform(req);
    }

    private static MockMultipartFile image(String part, byte[] bytes) {
        return new MockMultipartFile(part, "photo.png", "image/png", bytes);
    }

    private String token(ResultActions r) throws Exception { return body(r).path("token").asText(); }

    private JsonNode body(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private String client(String name) throws Exception {
        return token(send(MockMvcRequestBuilders.post("/api/auth/register"), null,
                new AuthDtos.RegisterRequest(name, "c-" + UUID.randomUUID() + "@test.local", "Secret123")).andExpect(status().isCreated()));
    }

    private long createProduct(String name, MockMultipartFile... image) throws Exception {
        return body(multipart(HttpMethod.POST, "/api/admin/products", admin, "product",
                Map.of("name", name, "description", "Description", "category", "Audio", "removeImage", false), image)
                .andExpect(status().isCreated())).path("id").asLong();
    }

    private JsonNode review(String token, String product, int rating, String text, MockMultipartFile... images) throws Exception {
        return body(multipart(HttpMethod.POST, "/api/me/reviews", token, "review",
                Map.of("product", product, "rating", rating, "text", text), images).andExpect(status().isCreated()));
    }

    private String unique(String prefix) { return prefix + " " + UUID.randomUUID().toString().substring(0, 6); }

    // ---------- catalogue ----------
    @Test
    void admin_gereLesProduits_avecImage_etLesAvisSuiventLeRenommage() throws Exception {
        String name = unique("Enceinte");
        long id = createProduct(name, image("image", PNG));
        JsonNode list = body(send(MockMvcRequestBuilders.get("/api/products"), client("Lina Saad"), null).andExpect(status().isOk()));
        JsonNode created = null;
        for (JsonNode p : list) if (p.path("id").asLong() == id) created = p;
        assertThat(created).isNotNull();
        String imageUrl = created.path("imageUrl").asText();
        assertThat(imageUrl).matches("/uploads/products/[a-f0-9-]{36}\\.png");
        mvc.perform(MockMvcRequestBuilders.get(imageUrl)).andExpect(status().isOk()); // image publique

        String clientToken = client("Lina Saad");
        review(clientToken, name.toUpperCase(), 4, "Très bon son, je recommande vivement");  // nom canonique
        String renamed = unique("Enceinte Pro");
        multipart(HttpMethod.PUT, "/api/admin/products/" + id, admin, "product",
                Map.of("name", renamed, "description", "Nouvelle", "removeImage", true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(renamed))
                .andExpect(jsonPath("$.imageUrl").doesNotExist())
                .andExpect(jsonPath("$.stats.reviewCount").value(1));
        send(MockMvcRequestBuilders.get("/api/me/reviews"), clientToken, null)
                .andExpect(jsonPath("$.content[0].product").value(renamed));

        send(MockMvcRequestBuilders.delete("/api/admin/products/" + id), admin, null).andExpect(status().isNoContent());
    }

    @Test
    void produits_nomEnDouble_409_etClientNePeutPasGerer_403() throws Exception {
        String name = unique("Lampe");
        createProduct(name);
        multipart(HttpMethod.POST, "/api/admin/products", admin, "product", Map.of("name", name.toLowerCase(), "removeImage", false))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.detail").value("Un produit porte déjà ce nom."));
        multipart(HttpMethod.POST, "/api/admin/products", client("Omar"), "product", Map.of("name", "Pirate", "removeImage", false))
                .andExpect(status().isForbidden());
    }

    @Test
    void imageNonValide_refusee_memeAvecUneExtensionImage() throws Exception {
        MockMultipartFile fake = new MockMultipartFile("image", "virus.png", "image/png", "<script>alert(1)</script>".getBytes());
        multipart(HttpMethod.POST, "/api/admin/products", admin, "product", Map.of("name", unique("Faux"), "removeImage", false), fake)
                .andExpect(status().isUnsupportedMediaType());
    }

    // ---------- avis client : photos, émojis, modification, suppression ----------
    @Test
    void client_deposeUnAvisAvecPhotosEtEmojis_puisLeModifie_etLeSupprime() throws Exception {
        String product = unique("Casque");
        createProduct(product);
        String me = client("Sara Benali");

        JsonNode r = review(me, product, 5, "Super casque 😍🎧 le son est incroyable 👍", image("images", PNG), image("images", JPG));
        long id = r.path("id").asLong();
        assertThat(r.path("text").asText()).contains("😍🎧");
        assertThat(r.path("imageUrls")).hasSize(2);
        String kept = r.path("imageUrls").get(0).asText();

        clearInvocations(huggingFace);
        // modification : nouveau texte (réanalysé), une photo gardée, une ajoutée
        when(huggingFace.classify(anyString())).thenReturn(new Dtos.ClassResult(SentimentLabel.NEGATIVE, 0.8));
        multipart(HttpMethod.PUT, "/api/me/reviews/" + id, me, "review",
                Map.of("product", product, "rating", 2, "text", "Finalement il grésille après une semaine 😕", "keepImages", List.of(kept)),
                image("images", PNG))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").value(2))
                .andExpect(jsonPath("$.imageUrls.length()").value(2))
                .andExpect(jsonPath("$.imageUrls[0]").value(kept))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
        verify(huggingFace, times(1)).classify(anyString()); // le nouveau texte est réanalysé

        // l'admin voit le nouveau sentiment
        send(MockMvcRequestBuilders.get("/api/admin/reviews/" + id), admin, null)
                .andExpect(jsonPath("$.label").value("NEGATIVE"));

        var events = ArgumentCaptor.forClass(Object.class);
        send(MockMvcRequestBuilders.delete("/api/me/reviews/" + id), me, null).andExpect(status().isNoContent());
        verify(notifications, atLeast(3)).broadcast(events.capture());
        assertThat(events.getAllValues()).extracting(e -> ((ReviewEvent) e).type())
                .contains("review.created", "review.updated", "review.deleted");
        send(MockMvcRequestBuilders.get("/api/admin/reviews/" + id), admin, null).andExpect(status().isNotFound());
    }

    @Test
    void client_neTouchePasAuxAvisDesAutres_404() throws Exception {
        String product = unique("Tapis");
        createProduct(product);
        long id = review(client("Sara"), product, 4, "Tapis confortable et épais").path("id").asLong();
        String other = client("Intrus");
        multipart(HttpMethod.PUT, "/api/me/reviews/" + id, other, "review", Map.of("product", product, "rating", 1, "text", "Je modifie l'avis d'un autre"))
                .andExpect(status().isNotFound());
        send(MockMvcRequestBuilders.delete("/api/me/reviews/" + id), other, null).andExpect(status().isNotFound());
    }

    @Test
    void avis_produitHorsCatalogue_ouTropDePhotos_400() throws Exception {
        String me = client("Sara");
        multipart(HttpMethod.POST, "/api/me/reviews", me, "review", Map.of("product", "Produit inventé", "rating", 3, "text", "Un avis assez long"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").value("Choisissez un produit du catalogue."));
        String product = unique("Montre");
        createProduct(product);
        multipart(HttpMethod.POST, "/api/me/reviews", me, "review", Map.of("product", product, "rating", 3, "text", "Un avis assez long"),
                image("images", PNG), image("images", PNG), image("images", PNG), image("images", PNG))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").value("3 photos maximum par avis."));
    }

    @Test
    void admin_supprimeUnAvis() throws Exception {
        String product = unique("Gourde");
        createProduct(product);
        long id = review(client("Sara"), product, 1, "Fuit dès le premier jour").path("id").asLong();
        send(MockMvcRequestBuilders.delete("/api/admin/reviews/" + id), client("Autre"), null).andExpect(status().isForbidden());
        send(MockMvcRequestBuilders.delete("/api/admin/reviews/" + id), admin, null).andExpect(status().isNoContent());
    }

    // ---------- profils ----------
    @Test
    void profil_nomEmailMotDePasseEtPhoto() throws Exception {
        String me = client("Sara Benali");
        String product = unique("Casque");
        createProduct(product);
        review(me, product, 5, "Excellent produit, je recommande");

        String email = "sara-" + UUID.randomUUID() + "@test.local";
        String newToken = token(send(MockMvcRequestBuilders.put("/api/account"), me, Map.of("fullName", "Sara B.", "email", email))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.fullName").value("Sara B.")));
        send(MockMvcRequestBuilders.get("/api/me/reviews"), newToken, null)
                .andExpect(jsonPath("$.content[0].product").value(product));
        // le nom affiché sur ses avis suit le profil
        send(MockMvcRequestBuilders.get("/api/reviews?size=200"), admin, null)
                .andExpect(jsonPath("$.content[?(@.authorName == 'Sara B.')]").exists());

        send(MockMvcRequestBuilders.put("/api/account/password"), newToken, Map.of("currentPassword", "faux", "newPassword", "Nouveau123"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").value("Mot de passe actuel incorrect."));
        send(MockMvcRequestBuilders.put("/api/account/password"), newToken, Map.of("currentPassword", "Secret123", "newPassword", "Nouveau123"))
                .andExpect(status().isNoContent());
        send(MockMvcRequestBuilders.post("/api/auth/login"), null, new AuthDtos.LoginRequest(email, "Nouveau123")).andExpect(status().isOk());

        mvc.perform(MockMvcRequestBuilders.multipart("/api/account/avatar").file(image("image", PNG)).header("Authorization", "Bearer " + newToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.startsWith("/uploads/avatars/")));
        send(MockMvcRequestBuilders.delete("/api/account/avatar"), newToken, null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").doesNotExist());
    }

    @Test
    void profil_emailDejaPris_409() throws Exception {
        send(MockMvcRequestBuilders.put("/api/account"), client("Sara"), Map.of("fullName", "Sara", "email", "admin@sentishop.local"))
                .andExpect(status().isConflict());
    }

    // ---------- administration des comptes ----------
    @Test
    void admin_changeLeRole_etSupprimeUnCompte_avecGardeFous() throws Exception {
        String clientToken = client("Futur admin");
        long id = body(send(MockMvcRequestBuilders.get("/api/account"), clientToken, null)).path("id").asLong();
        long adminId = body(send(MockMvcRequestBuilders.get("/api/account"), admin, null)).path("id").asLong();

        send(MockMvcRequestBuilders.put("/api/admin/users/" + adminId + "/role"), admin, Map.of("role", "CLIENT"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").value("Vous ne pouvez pas modifier votre propre rôle."));
        send(MockMvcRequestBuilders.delete("/api/admin/users/" + adminId), admin, null).andExpect(status().isBadRequest());

        send(MockMvcRequestBuilders.put("/api/admin/users/" + id + "/role"), admin, Map.of("role", "ADMIN"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("ADMIN"));
        send(MockMvcRequestBuilders.put("/api/admin/users/" + id + "/role"), admin, Map.of("role", "CLIENT")).andExpect(status().isOk());
        send(MockMvcRequestBuilders.delete("/api/admin/users/" + id), admin, null).andExpect(status().isNoContent());
        send(MockMvcRequestBuilders.get("/api/account"), clientToken, null).andExpect(status().isUnauthorized()); // compte supprimé
    }
}
