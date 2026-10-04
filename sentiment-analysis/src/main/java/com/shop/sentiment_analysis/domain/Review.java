package com.shop.sentiment_analysis.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.shop.sentiment_analysis.storage.FileStorageService;
import com.shop.sentiment_analysis.storage.StringListConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "review", indexes = @Index(name = "idx_review_text_hash", columnList = "text_hash"))
@Getter @Setter @NoArgsConstructor
public class Review {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "text", nullable = false)
    private String text;

    /** Pas unique : deux clients peuvent écrire le même avis. Le cache est dans ReviewAnalysis. */
    @JsonIgnore
    @Column(name = "text_hash", length = 64, nullable = false)
    private String textHash;

    @Column(length = 120)
    private String product;

    @Enumerated(EnumType.STRING)
    @Column(length = 10, nullable = false)
    private SentimentLabel label;

    private double score;

    @JsonIgnore
    private String model;

    /** Client qui a déposé l'avis (null pour un avis importé ou analysé par un admin). */
    @JsonIgnore
    @Column(name = "author_id")
    private Long authorId;

    @Column(name = "author_name", length = 120)
    private String authorName;

    /** Note de 1 à 5 étoiles donnée par le client (null pour un avis importé). */
    private Integer rating;

    /** Photos jointes par le client (noms de fichiers dans uploads/reviews). */
    @JsonIgnore
    @Convert(converter = StringListConverter.class)
    @Column(name = "images", length = 1000)
    private List<String> images = new ArrayList<>();

    private Instant createdAt = Instant.now();

    /** Dernière modification par son auteur (null si jamais modifié). */
    private Instant updatedAt;

    /** URLs publiques des photos, pour l'API. */
    @JsonProperty("imageUrls")
    public List<String> getImageUrls() {
        return images == null ? List.of() : images.stream().map(n -> FileStorageService.url(FileStorageService.Folder.REVIEWS, n)).toList();
    }
}
