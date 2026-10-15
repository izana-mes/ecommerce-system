package com.example.shop.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.converter.FormHttpMessageConverter;
import org.springframework.security.oauth2.client.endpoint.DefaultAuthorizationCodeTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.oauth2.core.http.converter.OAuth2AccessTokenResponseHttpMessageConverter;
import org.springframework.security.oauth2.client.http.OAuth2ErrorResponseErrorHandler;
import org.springframework.web.client.RestTemplate;

/**
 * Adds safe diagnostics to the authorization-code token exchange. It deliberately
 * logs only endpoint metadata and response status: never the authorization code,
 * client secret, authorization header, or token response.
 */
@Configuration
@Slf4j
public class OAuthTokenExchangeDiagnosticsConfiguration {

    @Bean
    OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> oauthTokenResponseClient() {
        RestTemplate restTemplate = new RestTemplate(List.of(
                new FormHttpMessageConverter(), new OAuth2AccessTokenResponseHttpMessageConverter()));
        restTemplate.setErrorHandler(new OAuth2ErrorResponseErrorHandler());
        restTemplate.setInterceptors(List.of(new SafeOAuthTokenExchangeInterceptor()));

        DefaultAuthorizationCodeTokenResponseClient client = new DefaultAuthorizationCodeTokenResponseClient();
        client.setRestOperations(restTemplate);
        return client;
    }

    private static final class SafeOAuthTokenExchangeInterceptor implements ClientHttpRequestInterceptor {
        @Override
        public ClientHttpResponse intercept(
                org.springframework.http.HttpRequest request,
                byte[] body,
                ClientHttpRequestExecution execution) throws IOException {
            boolean basicAuthenticationPresent = request.getHeaders().getFirst("Authorization") != null;
            String form = new String(body, StandardCharsets.UTF_8);
            log.info("oauth_token_exchange request method={} uri={} basicAuthPresent={} "
                            + "hasGrantType={} hasCode={} hasRedirectUri={}",
                    request.getMethod(), request.getURI(), basicAuthenticationPresent,
                    form.contains("grant_type="), form.contains("code="), form.contains("redirect_uri="));
            ClientHttpResponse response = execution.execute(request, body);
            log.info("oauth_token_exchange response status={} uri={}", response.getStatusCode().value(), request.getURI());
            return response;
        }
    }
}
