package com.shop.sentiment_analysis.repository;

import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    /** product = "" signifie « tous les produits » (y compris les avis sans produit). since = Instant.EPOCH : toute la période. */
    @Query("select r.label, count(r) from Review r where (:product = '' or r.product = :product) and r.createdAt >= :since group by r.label")
    List<Object[]> countByLabel(@Param("product") String product, @Param("since") Instant since);

    /** Série temporelle : [createdAt, label] des avis depuis une date (regroupés par jour côté service). */
    @Query("select r.createdAt, r.label from Review r where (:product = '' or r.product = :product) and r.createdAt >= :since")
    List<Object[]> timeline(@Param("product") String product, @Param("since") Instant since);

    /**
     * Liste filtrée des avis (back-office). Le tri vient du Pageable (date, confiance, produit, auteur…).
     * q cherche dans le texte et dans le nom de l'auteur ; label null = tous les sentiments.
     */
    @Query("""
           select r from Review r
           where (:label is null or r.label = :label)
             and (:product = '' or lower(r.product) like lower(concat('%', :product, '%')))
             and (:q = '' or lower(r.text) like lower(concat('%', :q, '%'))
                  or lower(coalesce(r.authorName, '')) like lower(concat('%', :q, '%')))
             and r.createdAt >= :since
           """)
    Page<Review> filter(@Param("label") SentimentLabel label, @Param("product") String product,
                        @Param("q") String q, @Param("since") Instant since, Pageable pageable);

    /** Avis déposés par un client donné (espace client). */
    Page<Review> findByAuthorIdOrderByCreatedAtDesc(Long authorId, Pageable pageable);

    /** Nombre d'avis par client : [authorId, count]. */
    @Query("select r.authorId, count(r) from Review r where r.authorId is not null group by r.authorId")
    List<Object[]> countByAuthor();

    /** Par produit : [nom, nombre d'avis, note moyenne, nb positifs, nb négatifs]. */
    @Query("""
           select r.product, count(r), avg(r.rating),
                  sum(case when r.label = com.shop.sentiment_analysis.domain.SentimentLabel.POSITIVE then 1 else 0 end),
                  sum(case when r.label = com.shop.sentiment_analysis.domain.SentimentLabel.NEGATIVE then 1 else 0 end)
           from Review r where r.product is not null group by r.product
           """)
    List<Object[]> statsByProduct();

    /** Renommage d'un produit : ses avis suivent. */
    @Modifying
    @Transactional
    @Query("update Review r set r.product = :newName where r.product = :oldName")
    int renameProduct(@Param("oldName") String oldName, @Param("newName") String newName);

    /** Changement de nom d'un client : ses avis affichent le nouveau nom. */
    @Modifying
    @Transactional
    @Query("update Review r set r.authorName = :name where r.authorId = :authorId")
    int renameAuthor(@Param("authorId") Long authorId, @Param("name") String name);

    /** Suppression d'un compte : ses avis restent (statistiques) mais ne lui sont plus rattachés. */
    @Modifying
    @Transactional
    @Query("update Review r set r.authorId = null, r.authorName = 'Ancien client' where r.authorId = :authorId")
    int detachAuthor(@Param("authorId") Long authorId);

    /** Avis d'un client (pour anonymiser à la suppression de son compte). */
    List<Review> findByAuthorId(Long authorId);

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
