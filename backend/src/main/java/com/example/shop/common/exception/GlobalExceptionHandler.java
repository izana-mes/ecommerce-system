package com.example.shop.common.exception;

import com.example.shop.common.response.ApiResponse;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.security.SignatureException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.context.support.DefaultMessageSourceResolvable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.util.stream.Collectors;

/**
 * Global exception handler to catch exceptions thrown anywhere in the
 * application
 * and return a consistent ApiResponse format.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

        @ExceptionHandler(BusinessException.class)
        public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
                return ResponseEntity
                                .status(e.getStatus())
                                .body(ApiResponse.error(e.getMessage()));
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException e) {
                String message = e.getBindingResult().getFieldErrors()
                                .stream()
                                .map(DefaultMessageSourceResolvable::getDefaultMessage)
                                .collect(Collectors.joining(", "));

                return ResponseEntity
                                .status(HttpStatus.BAD_REQUEST)
                                .body(ApiResponse.error(message));
        }

        @ExceptionHandler({
                        BadCredentialsException.class,
                        DisabledException.class,
                        LockedException.class,
                        UnauthorizedException.class,
                        ExpiredJwtException.class,
                        SignatureException.class
        })
        public ResponseEntity<ApiResponse<Void>> handleAuthenticationException(Exception e) {
                return ResponseEntity
                                .status(HttpStatus.UNAUTHORIZED)
                                .body(ApiResponse.error(e.getMessage()));
        }

        @ExceptionHandler(EntityNotFoundException.class)
        public ResponseEntity<ApiResponse<Void>> handleEntityNotFoundException(EntityNotFoundException e) {
                return ResponseEntity
                                .status(HttpStatus.NOT_FOUND)
                                .body(ApiResponse.error(e.getMessage()));
        }

        @ExceptionHandler(AccessDeniedException.class)
        public ResponseEntity<ApiResponse<Void>> handleAccessDeniedException(AccessDeniedException e) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                boolean unauthenticated = authentication == null
                                || authentication instanceof AnonymousAuthenticationToken
                                || !authentication.isAuthenticated();

                if (unauthenticated) {
                        return ResponseEntity
                                        .status(HttpStatus.UNAUTHORIZED)
                                        .body(ApiResponse.error("Not authenticated"));
                }

                return ResponseEntity
                                .status(HttpStatus.FORBIDDEN)
                                .body(ApiResponse.error("Access denied"));
        }

        @ExceptionHandler(NoResourceFoundException.class)
        public ResponseEntity<ApiResponse<Void>> handleNoResourceFoundException(NoResourceFoundException e) {
                String resourcePath = e.getResourcePath();
                if ("oauth2/authorization/google".equals(resourcePath)) {
                        return ResponseEntity
                                        .status(HttpStatus.SERVICE_UNAVAILABLE)
                                        .body(ApiResponse.error(
                                                        "Google OAuth is not configured on backend. Please set SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_ID and SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_SECRET."));
                }
                return ResponseEntity
                                .status(HttpStatus.NOT_FOUND)
                                .body(ApiResponse.error("Resource not found: " + resourcePath));
        }


        @ExceptionHandler(IllegalStateException.class)
        public ResponseEntity<ApiResponse<Void>> handleIllegalStateException(IllegalStateException e) {
                return ResponseEntity
                                .status(HttpStatus.BAD_REQUEST)
                                .body(ApiResponse.error(e.getMessage()));
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception e) {
                if (isClientDisconnect(e)) {
                        log.warn("Client disconnected before response could be fully written: {}", rootMessage(e));
                        return ResponseEntity.status(499).body(ApiResponse.error("Client closed request"));
                }
                log.error("Unhandled exception", e);
                String details = e.getMessage();
                if ((details == null || details.isBlank()) && e.getCause() != null) {
                        details = e.getCause().getMessage();
                }
                String safeDetails = (details == null || details.isBlank()) ? "unknown" : details;
                return ResponseEntity
                                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                                .body(ApiResponse.error("An internal error occurred. Details: " + safeDetails));
        }

        private boolean isClientDisconnect(Exception e) {
                String exClassName = e.getClass().getName();
                if ("org.springframework.web.context.request.async.AsyncRequestNotUsableException".equals(exClassName)) {
                        return true;
                }
                Throwable current = e;
                while (current != null) {
                        if (current instanceof IOException) {
                                String message = current.getMessage();
                                if (message != null) {
                                        String normalized = message.toLowerCase();
                                        if (normalized.contains("broken pipe")
                                                        || normalized.contains("connection reset by peer")) {
                                                return true;
                                        }
                                }
                        }
                        current = current.getCause();
                }
                return false;
        }

        private String rootMessage(Exception e) {
                Throwable current = e;
                String last = e.getMessage();
                while (current != null) {
                        if (current.getMessage() != null && !current.getMessage().isBlank()) {
                                last = current.getMessage();
                        }
                        current = current.getCause();
                }
                return last == null ? "unknown" : last;
        }
}
