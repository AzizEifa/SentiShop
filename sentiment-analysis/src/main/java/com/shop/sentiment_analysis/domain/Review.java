package com.shop.sentiment_analysis.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "review")
@Getter @Setter @NoArgsConstructor
public class Review {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "text", nullable = false)
    private String text;

    @JsonIgnore
    @Column(name = "text_hash", length = 64, nullable = false, unique = true)
    private String textHash;

    @Column(length = 120)
    private String product;

    @Enumerated(EnumType.STRING)
    @Column(length = 10, nullable = false)
    private SentimentLabel label;

    private double score;

    @JsonIgnore
    private String model;

    private Instant createdAt = Instant.now();
}
