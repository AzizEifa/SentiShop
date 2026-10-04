package com.shop.sentiment_analysis.repository;

import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    Optional<Review> findByTextHash(String hash);

    /** product = "" signifie « tous les produits » (y compris les avis sans produit). */
    @Query("select r.label, count(r) from Review r where (:product = '' or r.product = :product) group by r.label")
    List<Object[]> countByLabel(@Param("product") String product);

    @Query("select distinct r.product from Review r where r.product is not null order by r.product")
    List<String> findProducts();

    @Query("""
           select r from Review r
           where (:product = '' or lower(r.product) like lower(concat('%', :product, '%')))
           order by r.createdAt desc
           """)
    Page<Review> search(@Param("product") String product, Pageable pageable);

    @Query("""
           select r from Review r
           where r.label = :label
             and (:product = '' or lower(r.product) like lower(concat('%', :product, '%')))
           order by r.createdAt desc
           """)
    Page<Review> searchByLabel(@Param("label") SentimentLabel label, @Param("product") String product, Pageable pageable);
}
