package com.shop.sentiment_analysis.product;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Catalogue : lecture pour tout utilisateur connecté, gestion réservée aux administrateurs
 * (/api/admin/** est protégé par SecurityConfig). Création / modification en multipart :
 * partie "product" (JSON) + partie "image" facultative.
 */
@RestController
@RequiredArgsConstructor
public class ProductController {

    private final ProductService products;

    @GetMapping("/api/products")
    public List<ProductDtos.ProductDto> list() {
        return products.list();
    }

    @PostMapping(value = "/api/admin/products", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ProductDtos.ProductDto create(@Valid @RequestPart("product") ProductDtos.ProductRequest req,
                                         @RequestPart(value = "image", required = false) MultipartFile image) {
        return products.create(req, image);
    }

    @PutMapping(value = "/api/admin/products/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProductDtos.ProductDto update(@PathVariable Long id,
                                         @Valid @RequestPart("product") ProductDtos.ProductRequest req,
                                         @RequestPart(value = "image", required = false) MultipartFile image) {
        return products.update(id, req, image);
    }

    @DeleteMapping("/api/admin/products/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        products.delete(id);
    }
}
