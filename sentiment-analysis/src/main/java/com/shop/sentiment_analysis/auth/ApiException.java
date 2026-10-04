package com.shop.sentiment_analysis.auth;

import org.springframework.http.HttpStatus;

/** Erreur métier avec un message lisible, renvoyée au front sous forme de ProblemDetail. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() { return status; }
}
