package com.shop.sentiment_analysis.cache;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class ReviewHasher {
    private ReviewHasher() {}

    public static String normalize(String text) {
        return text.strip().replaceAll("\\s+", " ");
    }

    /** SHA-256 de (texte normalisé + modèle) : changer de modèle invalide naturellement le cache. */
    public static String hash(String text, String model) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256")
                    .digest((normalize(text) + "|" + model).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
