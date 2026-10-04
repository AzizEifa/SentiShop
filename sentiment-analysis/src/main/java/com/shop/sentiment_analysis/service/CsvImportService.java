package com.shop.sentiment_analysis.service;

import com.opencsv.CSVReaderHeaderAware;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.exception.HfUnavailableException;
import lombok.RequiredArgsConstructor;
import org.apache.commons.io.input.BOMInputStream;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CsvImportService {

    private static final int MAX_ROWS = 2000;
    private final SentimentService sentiment;

    /** CSV attendu : en-tête "text,product", UTF-8 (BOM toléré). */
    public Dtos.ImportReport importCsv(MultipartFile file) throws Exception {
        List<String> errors = new ArrayList<>();
        int total = 0, analyzed = 0, hits = 0;

        try (var in = new InputStreamReader(
                BOMInputStream.builder().setInputStream(file.getInputStream()).get(), StandardCharsets.UTF_8);
             var reader = new CSVReaderHeaderAware(in)) {

            Map<String, String> row;
            while ((row = reader.readMap()) != null) {
                if (++total > MAX_ROWS) {
                    total = MAX_ROWS;
                    errors.add("Limite de " + MAX_ROWS + " lignes atteinte, le reste est ignoré");
                    break;
                }
                String text = row.get("text");
                if (text == null || text.isBlank()) {
                    errors.add("Ligne " + total + " : texte vide");
                    continue;
                }
                try {
                    var r = sentiment.analyze(text, row.get("product"));
                    analyzed++;
                    if (r.cached()) hits++;
                } catch (HfUnavailableException e) {
                    errors.add("Ligne " + total + " : " + e.getMessage());
                    if (e.getStatus() == 429) break; // quota épuisé : inutile d'insister
                }
            }
        }
        return new Dtos.ImportReport(total, analyzed, hits, errors);
    }
}
