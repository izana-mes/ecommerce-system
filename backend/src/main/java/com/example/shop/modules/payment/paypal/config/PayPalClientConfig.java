package com.example.shop.modules.payment.paypal.config;

import com.paypal.core.PayPalEnvironment;
import com.paypal.core.PayPalHttpClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Instantiates the official PayPal SDK {@link PayPalHttpClient}.
 *
 * <p>The client is a singleton that handles OAuth2 token caching internally.
 * Credentials are injected via {@link PayPalProperties} — never hardcoded.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class PayPalClientConfig {

    private final PayPalProperties payPalProperties;

    @Bean
    public PayPalHttpClient payPalHttpClient() {
        String clientId = payPalProperties.getClientId();
        String clientSecret = payPalProperties.getClientSecret();
        String mode = payPalProperties.getMode();

        if (clientId.isBlank() || clientSecret.isBlank()) {
            log.warn("PayPal credentials not configured — PayPal payments will be unavailable");
        }

        PayPalEnvironment environment = "live".equalsIgnoreCase(mode)
                ? new PayPalEnvironment.Live(clientId, clientSecret)
                : new PayPalEnvironment.Sandbox(clientId, clientSecret);

        log.info("PayPal client initialised in [{}] mode", mode.toUpperCase());
        return new PayPalHttpClient(environment);
    }
}
