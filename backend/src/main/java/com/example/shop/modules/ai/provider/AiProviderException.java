package com.example.shop.modules.ai.provider;

public class AiProviderException extends RuntimeException {
    private final boolean retryable;
    public AiProviderException(String message, boolean retryable) { super(message); this.retryable = retryable; }
    public boolean retryable() { return retryable; }
}
