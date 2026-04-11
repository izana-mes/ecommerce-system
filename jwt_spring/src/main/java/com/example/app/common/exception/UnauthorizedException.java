package com.example.app.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception thrown when a user tries to access a resource they are not
 * authenticated for
 * or when authentication fails.
 * Maps to HTTP 401 Unauthorized.
 */
public class UnauthorizedException extends BusinessException {

    public UnauthorizedException(String message) {
        super(message, HttpStatus.UNAUTHORIZED);
    }
}
