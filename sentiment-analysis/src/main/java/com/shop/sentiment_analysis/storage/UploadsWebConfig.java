package com.shop.sentiment_analysis.storage;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.Duration;

/** Sert les images enregistrées : /uploads/products/…, /uploads/reviews/…, /uploads/avatars/… */
@Configuration
@RequiredArgsConstructor
public class UploadsWebConfig implements WebMvcConfigurer {

    private final FileStorageService storage;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(storage.root().toUri().toString())
                // un fichier n'est jamais modifié (nouveau nom à chaque envoi) : mise en cache longue
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic());
    }
}
