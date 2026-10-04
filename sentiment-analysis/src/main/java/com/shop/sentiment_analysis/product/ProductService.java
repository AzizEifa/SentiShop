package com.shop.sentiment_analysis.product;

import com.shop.sentiment_analysis.auth.ApiException;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import com.shop.sentiment_analysis.storage.FileStorageService;
import com.shop.sentiment_analysis.storage.FileStorageService.Folder;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository products;
    private final ReviewRepository reviews;
    private final FileStorageService storage;

    /** Catalogue avec les statistiques de chaque produit (nombre d'avis, note moyenne, % positifs / négatifs). */
    public List<ProductDtos.ProductDto> list() {
        Map<String, ProductDtos.Stats> stats = new HashMap<>();
        for (Object[] row : reviews.statsByProduct()) {
            long count = ((Number) row[1]).longValue();
            Double avg = row[2] == null ? null : Math.round(((Number) row[2]).doubleValue() * 10) / 10.0;
            stats.put(((String) row[0]).toLowerCase(), new ProductDtos.Stats(count, avg,
                    pct(((Number) row[3]).longValue(), count), pct(((Number) row[4]).longValue(), count)));
        }
        return products.findAllByOrderByNameAsc().stream()
                .map(p -> ProductDtos.ProductDto.of(p, stats.getOrDefault(p.getName().toLowerCase(), ProductDtos.Stats.EMPTY)))
                .toList();
    }

    public ProductDtos.ProductDto create(ProductDtos.ProductRequest req, MultipartFile image) {
        String name = req.name().strip();
        if (products.existsByNameIgnoreCase(name)) throw duplicate();
        Product p = new Product(name);
        fill(p, req);
        if (image != null && !image.isEmpty()) p.setImageName(storage.saveImage(image, Folder.PRODUCTS));
        return ProductDtos.ProductDto.of(products.save(p), ProductDtos.Stats.EMPTY);
    }

    public ProductDtos.ProductDto update(Long id, ProductDtos.ProductRequest req, MultipartFile image) {
        Product p = get(id);
        String oldName = p.getName();
        String name = req.name().strip();
        if (!name.equalsIgnoreCase(oldName) && products.existsByNameIgnoreCase(name)) throw duplicate();
        p.setName(name);
        fill(p, req);
        if (image != null && !image.isEmpty()) {
            String old = p.getImageName();
            p.setImageName(storage.saveImage(image, Folder.PRODUCTS));
            storage.delete(Folder.PRODUCTS, old);
        } else if (req.removeImage()) {
            storage.delete(Folder.PRODUCTS, p.getImageName());
            p.setImageName(null);
        }
        p.setUpdatedAt(Instant.now());
        products.save(p);
        if (!name.equals(oldName)) reviews.renameProduct(oldName, name); // les avis suivent le nouveau nom
        return list().stream().filter(d -> d.id().equals(id)).findFirst().orElseThrow();
    }

    /** Les avis déjà déposés sont conservés (historique), seul le produit disparaît du catalogue. */
    public void delete(Long id) {
        Product p = get(id);
        products.delete(p);
        storage.delete(Folder.PRODUCTS, p.getImageName());
    }

    /** Nom canonique d'un produit du catalogue (insensible à la casse), si le catalogue le connaît. */
    public Optional<String> canonicalName(String name) {
        return name == null ? Optional.empty() : products.findByNameIgnoreCase(name.strip()).map(Product::getName);
    }

    private Product get(Long id) {
        return products.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Produit introuvable."));
    }

    private static void fill(Product p, ProductDtos.ProductRequest req) {
        p.setDescription(blankToNull(req.description()));
        p.setCategory(blankToNull(req.category()));
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "Un produit porte déjà ce nom.");
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.strip(); }

    private static double pct(long v, long total) { return total == 0 ? 0 : Math.round(v * 1000.0 / total) / 10.0; }
}
