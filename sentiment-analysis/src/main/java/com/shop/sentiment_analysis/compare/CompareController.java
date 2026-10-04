package com.shop.sentiment_analysis.compare;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class CompareController {

    private final CompareService service;

    /** B3 : POST /api/reviews/compare {text} → résultat des deux modèles + accord. */
    @PostMapping("/compare")
    public CompareDtos.CompareResponse compare(@Valid @RequestBody CompareDtos.CompareRequest req) {
        return service.compare(req.text());
    }
}
