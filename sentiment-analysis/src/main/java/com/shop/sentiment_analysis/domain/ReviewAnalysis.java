package com.shop.sentiment_analysis.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Cache persistant des analyses : un texte normalisé (+ modèle) = une seule ligne, un seul appel API.
 * Les avis clients eux-mêmes sont dans la table review (une ligne par avis, doublons compris).
 */
@Entity
@Table(name = "review_analysis")
@Getter @Setter @NoArgsConstructor
public class ReviewAnalysis {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "text_hash", length = 64, nullable = false, unique = true)
    private String textHash;

    @Enumerated(EnumType.STRING)
    @Column(length = 10, nullable = false)
    private SentimentLabel label;

    private double score;

    private String model;

    private Instant createdAt = Instant.now();
}
