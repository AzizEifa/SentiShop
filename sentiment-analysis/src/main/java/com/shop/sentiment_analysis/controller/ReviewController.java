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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;

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

    /** Colonnes triables (le tri par défaut est le plus récent d'abord). */
    private static final Set<String> SORTABLE = Set.of("createdAt", "score", "product", "authorName", "rating", "label");

    /**
     * Avis filtrés : produit, sentiment, recherche (texte ou auteur), période en jours.
     * Tri : ?sort=score,desc (colonnes de SORTABLE uniquement, les autres sont ignorées).
     */
    @GetMapping
    public Page<Review> list(@RequestParam(defaultValue = "") String product,
                             @RequestParam(required = false) SentimentLabel label,
                             @RequestParam(defaultValue = "") String q,
                             @RequestParam(required = false) Integer days,
                             Pageable pageable) {
        Sort sort = Sort.by(pageable.getSort().stream().filter(o -> SORTABLE.contains(o.getProperty())).toList());
        if (sort.isUnsorted()) sort = Sort.by(Sort.Direction.DESC, "createdAt");
        sort = sort.and(Sort.by(Sort.Direction.DESC, "id")); // ordre stable d'une page à l'autre
        Instant since = days == null || days <= 0 ? Instant.EPOCH : Instant.now().minus(Duration.ofDays(Math.min(days, 366)));
        return repo.filter(label, product.strip(), q.strip(), since,
                PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100), sort));
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
