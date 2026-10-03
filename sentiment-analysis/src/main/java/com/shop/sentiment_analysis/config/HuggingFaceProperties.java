package com.shop.sentiment_analysis.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "huggingface")
public record HuggingFaceProperties(String baseUrl, String token, String model,
                                    String summaryModel, Duration timeout) {}
