package com.shop.sentiment_analysis.controller;

import com.shop.sentiment_analysis.domain.Review;
import com.shop.sentiment_analysis.domain.SentimentLabel;
import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import com.shop.sentiment_analysis.service.CsvImportService;
import com.shop.sentiment_analysis.service.ExportService;
import com.shop.sentiment_analysis.service.SentimentService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final SentimentService sentiment;
    private final CsvImportService importer;
    private final ExportService exporter;
    private final ReviewRepository repo;

    @PostMapping("/analyze")
    public Dtos.AnalyzeResponse analyze(@Valid @RequestBody Dtos.AnalyzeRequest req) {
        return sentiment.analyze(req.text(), req.product());
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Dtos.ImportReport importCsv(@RequestParam("file") MultipartFile file) throws Exception {
        return importer.importCsv(file);
    }

    @GetMapping
    public Page<Review> list(@RequestParam(defaultValue = "") String product,
                             @RequestParam(required = false) SentimentLabel label,
                             Pageable pageable) {
        String p = product.strip();
        return label == null ? repo.search(p, pageable) : repo.searchByLabel(label, p, pageable);
    }

    @GetMapping("/export")
    public void export(@RequestParam(required = false) String product, HttpServletResponse res) throws IOException {
        res.setContentType("text/csv; charset=UTF-8");
        res.setHeader("Content-Disposition", "attachment; filename=avis.csv");
        var out = res.getOutputStream();
        out.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF}); // BOM : Excel lit bien l'arabe
        exporter.writeCsv(product, new OutputStreamWriter(out, StandardCharsets.UTF_8));
    }
}
