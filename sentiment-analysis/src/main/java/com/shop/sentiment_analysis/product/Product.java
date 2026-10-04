package com.shop.sentiment_analysis.product;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Produit du catalogue. Les avis le référencent par son nom (champ review.product). */
@Entity
@Table(name = "product")
@Getter @Setter @NoArgsConstructor
public class Product {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    @Column(length = 600)
    private String description;

    @Column(length = 60)
    private String category;

    /** Image dans uploads/products (null : visuel par défaut). */
    @Column(name = "image_name", length = 60)
    private String imageName;

    private Instant createdAt = Instant.now();
    private Instant updatedAt;

    public Product(String name) { this.name = name; }
}
