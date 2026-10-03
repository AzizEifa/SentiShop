package com.shop.sentiment_analysis.exception;

import com.opencsv.exceptions.CsvValidationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(HfUnavailableException.class)
    ProblemDetail hf(HfUnavailableException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.valueOf(e.getStatus()), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail validation(MethodArgumentNotValidException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Texte requis (max 2000 caractères)");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ProblemDetail tooBig(MaxUploadSizeExceededException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.PAYLOAD_TOO_LARGE, "Fichier trop volumineux (5 Mo max)");
    }

    @ExceptionHandler(CsvValidationException.class)
    ProblemDetail csv(CsvValidationException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "CSV invalide : " + e.getMessage());
    }
}
