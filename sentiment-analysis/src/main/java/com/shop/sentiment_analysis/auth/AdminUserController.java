package com.shop.sentiment_analysis.auth;

import com.shop.sentiment_analysis.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Administration : liste des comptes et de leur activité (ADMIN uniquement, cf. SecurityConfig). */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AppUserRepository users;
    private final ReviewRepository reviews;

    public record UserRow(Long id, String email, String fullName, Role role, Instant createdAt, long reviewCount) {}

    @GetMapping
    public List<UserRow> list() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : reviews.countByAuthor()) counts.put((Long) row[0], (Long) row[1]);
        return users.findAllByOrderByCreatedAtDesc().stream()
                .map(u -> new UserRow(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getCreatedAt(),
                        counts.getOrDefault(u.getId(), 0L)))
                .toList();
    }
}
