package com.shop.sentiment_analysis.service;

import com.opencsv.CSVWriter;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.Writer;

@Service
@RequiredArgsConstructor
public class ExportService {

    private final ReviewRepository repo;

    public void writeCsv(String product, Writer w) throws IOException {
        try (var csv = new CSVWriter(w)) {
            csv.writeNext(new String[]{"text", "product", "label", "score"});
            repo.search(product == null ? "" : product.strip(), Pageable.unpaged()).forEach(r ->
                    csv.writeNext(new String[]{
                            r.getText(), r.getProduct() == null ? "" : r.getProduct(),
                            r.getLabel().name(), String.valueOf(r.getScore())}));
        }
    }
}
