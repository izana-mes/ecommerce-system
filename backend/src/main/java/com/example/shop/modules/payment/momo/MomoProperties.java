package com.example.shop.modules.payment.momo;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

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

    private long usdToVndRate = 26_000;
}
