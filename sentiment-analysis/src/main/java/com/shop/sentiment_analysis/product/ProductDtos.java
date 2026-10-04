package com.shop.sentiment_analysis.product;

import com.shop.sentiment_analysis.storage.FileStorageService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class ProductDtos {
    private ProductDtos() {}

    public record ProductRequest(
            @NotBlank(message = "Le nom du produit est requis")
            @Size(max = 120, message = "Nom trop long (120 caractères max)")
            String name,
            @Size(max = 600, message = "Description trop longue (600 caractères max)")
            String description,
            @Size(max = 60, message = "Catégorie trop longue (60 caractères max)")
            String category,
            /** true : retirer l'image actuelle (si aucune nouvelle image n'est envoyée). */
            boolean removeImage) {}

    /** Statistiques calculées sur les avis du produit. */
    public record Stats(long reviewCount, Double averageRating, double positivePct, double negativePct) {
        public static final Stats EMPTY = new Stats(0, null, 0, 0);
    }

    public record ProductDto(Long id, String name, String description, String category, String imageUrl,
                             Instant createdAt, Stats stats) {
        public static ProductDto of(Product p, Stats stats) {
            return new ProductDto(p.getId(), p.getName(), p.getDescription(), p.getCategory(),
                    FileStorageService.url(FileStorageService.Folder.PRODUCTS, p.getImageName()), p.getCreatedAt(), stats);
        }
    }
}
