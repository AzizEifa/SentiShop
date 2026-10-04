package com.shop.sentiment_analysis.product;

import com.shop.sentiment_analysis.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Catalogue vide au démarrage : on le remplit avec les produits déjà présents dans les avis
 * (base existante), sinon avec quelques produits de démonstration.
 */
@Slf4j
@Order(20)
@Component
@RequiredArgsConstructor
public class ProductSeeder implements ApplicationRunner {

    private static final List<String[]> DEMO = List.of(
            new String[]{"Casque Bluetooth", "Casque sans fil à réduction de bruit, 30 h d'autonomie.", "Audio"},
            new String[]{"Montre connectée", "Suivi d'activité, notifications et mesure du sommeil.", "Objets connectés"},
            new String[]{"Tapis de yoga", "Tapis antidérapant de 6 mm, matière recyclée.", "Sport"});

    private final ProductRepository products;
    private final ReviewRepository reviews;

    @Value("${app.demo-client.enabled:false}")
    private boolean demo;

    @Override
    public void run(ApplicationArguments args) {
        if (products.count() > 0) return;
        List<String> fromReviews = reviews.findProducts();
        fromReviews.stream().filter(n -> !n.isBlank() && n.length() <= 120)
                .forEach(n -> { if (!products.existsByNameIgnoreCase(n)) products.save(new Product(n.strip())); });
        if (products.count() == 0 && demo) {
            for (String[] d : DEMO) {
                Product p = new Product(d[0]);
                p.setDescription(d[1]);
                p.setCategory(d[2]);
                products.save(p);
            }
        }
        log.info("Catalogue initialisé : {} produit(s)", products.count());
    }
}
