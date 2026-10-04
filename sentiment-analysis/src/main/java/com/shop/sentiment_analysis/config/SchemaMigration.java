package com.shop.sentiment_analysis.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Migration des bases créées avant la séparation review / review_analysis.
 * Avant : review.text_hash était UNIQUE (la table servait aussi de cache), donc un avis identique
 * n'était enregistré qu'une fois. ddl-auto=update ne supprime pas cette contrainte : on le fait ici,
 * après avoir recopié les analyses existantes dans le cache pour ne pas repayer d'appels API.
 * Sans effet sur une base neuve ou déjà migrée (H2 et PostgreSQL : information_schema standard).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        List<String> constraints = jdbc.queryForList("""
                select tc.constraint_name
                from information_schema.table_constraints tc
                join information_schema.key_column_usage k
                  on k.constraint_name = tc.constraint_name and k.table_name = tc.table_name
                where lower(tc.table_name) = 'review'
                  and tc.constraint_type = 'UNIQUE'
                  and lower(k.column_name) = 'text_hash'
                """, String.class);
        if (constraints.isEmpty()) return;

        int copied = jdbc.update("""
                insert into review_analysis (text_hash, label, score, model, created_at)
                select r.text_hash, r.label, r.score, r.model, r.created_at from review r
                where not exists (select 1 from review_analysis a where a.text_hash = r.text_hash)
                """);
        for (String name : constraints) {
            jdbc.execute("alter table review drop constraint \"" + name + "\"");
        }
        log.info("Migration : {} analyse(s) copiée(s) dans review_analysis, contrainte unique sur review.text_hash supprimée", copied);
    }
}
