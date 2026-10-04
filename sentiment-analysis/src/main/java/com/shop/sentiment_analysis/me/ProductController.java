package com.shop.sentiment_analysis.me;

import com.shop.sentiment_analysis.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Liste des produits connus, pour l'auto-complétion du formulaire d'avis (tout utilisateur connecté). */
@RestController
@RequiredArgsConstructor
public class ProductController {

    private final ReviewRepository reviews;

    @GetMapping("/api/products")
    public List<String> products() {
        return reviews.findProducts();
    }
}
