package com.shop.sentiment_analysis.auth;

import com.shop.sentiment_analysis.me.MeController;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Erreurs des modules compte et espace client, en français et champ par champ.
 * Limité à ces contrôleurs pour ne pas changer les messages existants du reste de l'API.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = {AuthController.class, MeController.class, AdminUserController.class})
public class AuthExceptionHandler {

    @ExceptionHandler(ApiException.class)
    ProblemDetail api(ApiException e) {
        return ProblemDetail.forStatusAndDetail(e.getStatus(), e.getMessage());
    }

    /** { detail: "premier message", errors: { champ: message } } : le front affiche l'erreur sous chaque champ. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail validation(MethodArgumentNotValidException e) {
        Map<String, String> errors = new LinkedHashMap<>();
        for (FieldError f : e.getBindingResult().getFieldErrors()) errors.putIfAbsent(f.getField(), f.getDefaultMessage());
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                errors.values().stream().findFirst().orElse("Données invalides"));
        p.setProperty("errors", errors);
        return p;
    }
}
