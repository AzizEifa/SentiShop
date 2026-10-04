package com.shop.sentiment_analysis.exception;

public class HfUnavailableException extends RuntimeException {
    private final int status;

    public HfUnavailableException(String message, int status) {
        super(message);
        this.status = status;
    }

    public int getStatus() { return status; }
}
