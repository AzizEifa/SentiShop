package com.shop.sentiment_analysis.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties(HuggingFaceProperties.class)
public class AppConfig implements WebMvcConfigurer {

    @Value("${app.cors-origin}")
    private String corsOrigin;

    @Bean
    WebClient hfWebClient(HuggingFaceProperties p) {
        return WebClient.builder()
                .baseUrl(p.baseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + p.token())
                .build();
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**").allowedOrigins(corsOrigin).allowedMethods("GET", "POST");
    }
}
