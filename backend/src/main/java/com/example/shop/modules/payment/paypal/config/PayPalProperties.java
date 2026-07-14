package com.example.shop.modules.payment.paypal.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Typed properties for PayPal integration.
 * All values are sourced from environment variables — never hardcoded.
 *
 * <p>Sandbox usage:
 * <pre>
 *   PAYPAL_CLIENT_ID=...
 *   PAYPAL_CLIENT_SECRET=...
 *   PAYPAL_MODE=sandbox       # or "live"
 * </pre>
 */
@Configuration
@ConfigurationProperties(prefix = "application.payment.paypal")
@Getter
@Setter
public class PayPalProperties {

    /** PayPal OAuth2 client ID (from Developer Dashboard). */
    private String clientId = "";

    /** PayPal OAuth2 client secret — NEVER expose to frontend. */
    private String clientSecret = "";

    /**
     * Environment mode: "sandbox" or "live".
     * Defaults to sandbox to prevent accidental live charges.
     */
    private String mode = "sandbox";
}
