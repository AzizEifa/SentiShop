package com.shop.sentiment_analysis.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

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

    private Instant createdAt = Instant.now();
}
