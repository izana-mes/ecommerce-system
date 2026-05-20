package com.example.shop.modules.payment.controller;

import com.example.shop.common.web.ClientIpExtractor;
import com.example.shop.common.web.RateLimitFilter;
import com.example.shop.common.web.RequestObservabilityFilter;
import com.example.shop.config.SecurityConfig;
import com.example.shop.modules.auth.oauth.OAuth2AuthenticationSuccessHandler;
import com.example.shop.modules.auth.oauth.OAuth2CookieAuthorizationRequestRepository;
import com.example.shop.modules.auth.security.JwtAuthenticationFilter;
import com.example.shop.modules.chatbot.security.McpServiceTokenFilter;
import com.example.shop.modules.payment.service.MomoPaymentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = MomoPaymentController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = SecurityConfig.class))
@AutoConfigureMockMvc(addFilters = false)
class MomoPaymentControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private MomoPaymentService momoPaymentService;
    @MockBean private ClientIpExtractor clientIpExtractor;
    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockBean private RateLimitFilter rateLimitFilter;
    @MockBean private RequestObservabilityFilter requestObservabilityFilter;
    @MockBean private McpServiceTokenFilter mcpServiceTokenFilter;
    @MockBean private UserDetailsService userDetailsService;
    @MockBean private OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler;
    @MockBean private OAuth2CookieAuthorizationRequestRepository oAuth2CookieAuthorizationRequestRepository;

    @Test
    void handleIpn_returnsNoContent() throws Exception {
        mockMvc.perform(post("/api/payments/momo/ipn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderId\":\"ORD-1\"}"))
                .andExpect(status().isNoContent());
    }
}
