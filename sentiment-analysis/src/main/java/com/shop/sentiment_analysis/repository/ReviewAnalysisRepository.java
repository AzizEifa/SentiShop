package com.shop.sentiment_analysis.repository;

import com.shop.sentiment_analysis.domain.ReviewAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReviewAnalysisRepository extends JpaRepository<ReviewAnalysis, Long> {

    Optional<ReviewAnalysis> findByTextHash(String hash);
}
