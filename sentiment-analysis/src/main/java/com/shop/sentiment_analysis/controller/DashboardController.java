package com.shop.sentiment_analysis.controller;

import com.shop.sentiment_analysis.dto.Dtos;
import com.shop.sentiment_analysis.repository.ReviewRepository;
import com.shop.sentiment_analysis.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService service;
    private final ReviewRepository repo;

    @GetMapping("/stats")
    public Dtos.DashboardStats stats(@RequestParam(required = false) String product,
                                     @RequestParam(required = false) Integer days) {
        return service.stats(product, days);
    }

    /** Avis par jour et par sentiment sur les N derniers jours (30 par défaut, 366 max). */
    @GetMapping("/trend")
    public List<Dtos.TrendPoint> trend(@RequestParam(required = false) String product,
                                       @RequestParam(defaultValue = "30") int days) {
        return service.trend(product, days);
    }

    @GetMapping("/products")
    public List<String> products() { return repo.findProducts(); }

    @PostMapping("/summary/negative")
    public Dtos.SummaryResponse summary(@RequestParam(required = false) String product) {
        return service.summarizeNegatives(product);
    }
}
