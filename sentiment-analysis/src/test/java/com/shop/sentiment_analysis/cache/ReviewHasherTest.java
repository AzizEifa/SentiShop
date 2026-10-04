package com.shop.sentiment_analysis.cache;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ReviewHasherTest {

    @Test
    void normalise_espaces_sansToucherALaCasse() {
        assertThat(ReviewHasher.normalize("  Très   BON\n produit ")).isEqualTo("Très BON produit");
    }

    @Test
    void memeTexteNormalise_memeHash() {
        assertThat(ReviewHasher.hash("Super  produit", "m")).isEqualTo(ReviewHasher.hash(" Super produit ", "m"));
    }

    @Test
    void changerDeModele_changeLeHash() {
        assertThat(ReviewHasher.hash("Super", "modele-a")).isNotEqualTo(ReviewHasher.hash("Super", "modele-b"));
    }

    @Test
    void hash_sha256_64CaracteresHex_meme_en_arabe() {
        assertThat(ReviewHasher.hash("المنتج رائع", "m")).hasSize(64).matches("[0-9a-f]+");
    }
}
