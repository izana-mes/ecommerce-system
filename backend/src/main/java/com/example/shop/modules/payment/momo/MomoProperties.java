package com.example.shop.modules.payment.momo;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
@ConfigurationProperties(prefix = "application.payment.momo")
@Getter
@Setter
public class MomoProperties {

    /** MoMo partnerCode for the active environment. */
    private String partnerCode = "";

    private String accessKey = "";

    private String secretKey = "";

    /** Host only, e.g. https://test-payment.momo.vn (sandbox) or https://payment.momo.vn. */
    private String endpoint = "https://test-payment.momo.vn";

    private String redirectUrl = "http://localhost:3000/payment/momo-return";

    private String ipnUrl = "http://localhost:8080/api/payments/momo/ipn";

    /** Default requestType: payWithMethod (Collection Link with e-wallet, ATM, card). */
    private String requestType = "payWithMethod";

    private String partnerName = "Shop";

    private String storeId = "MoMoTestStore";

    private long usdToVndRate = 26_000;

    private int connectTimeoutMs = 10_000;

    private int readTimeoutMs = 30_000;

    public boolean isConfigured() {
        return StringUtils.hasText(partnerCode)
                && StringUtils.hasText(accessKey)
                && StringUtils.hasText(secretKey);
    }

    public String getCreateUrl() {
        String base = endpoint == null ? "" : endpoint.trim().replaceAll("/+$", "");
        if (base.endsWith("/v2/gateway/api/create")) {
            return base;
        }
        return base + "/v2/gateway/api/create";
    }

    public String getQueryUrl() {
        String base = endpoint == null ? "" : endpoint.trim().replaceAll("/+$", "");
        if (base.endsWith("/v2/gateway/api/query")) {
            return base;
        }
        return base + "/v2/gateway/api/query";
    }
}
