package com.example.shop.modules.auth.controller;

import com.example.shop.modules.auth.dto.request.LoginRequest;
import com.example.shop.modules.auth.dto.response.AuthenticationResponse;
import com.example.shop.modules.auth.security.AuthCookieService;
import com.example.shop.modules.auth.service.AuthService;
import com.example.shop.common.web.ClientIpExtractor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import com.example.shop.config.SecurityConfig;
import com.example.shop.common.web.RateLimitFilter;
import com.example.shop.common.web.RequestObservabilityFilter;
import com.example.shop.modules.auth.oauth.OAuth2AuthenticationSuccessHandler;
import com.example.shop.modules.auth.oauth.OAuth2CookieAuthorizationRequestRepository;
import com.example.shop.modules.auth.security.JwtAuthenticationFilter;
import com.example.shop.modules.chatbot.security.McpServiceTokenFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = AuthController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = SecurityConfig.class))
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private AuthService authService;
    @MockBean private AuthCookieService authCookieService;
    @MockBean private ClientIpExtractor clientIpExtractor;
    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockBean private RateLimitFilter rateLimitFilter;
    @MockBean private RequestObservabilityFilter requestObservabilityFilter;
    @MockBean private McpServiceTokenFilter mcpServiceTokenFilter;
    @MockBean private UserDetailsService userDetailsService;
    @MockBean private OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler;
    @MockBean private OAuth2CookieAuthorizationRequestRepository oAuth2CookieAuthorizationRequestRepository;

    @Test
    void authenticate_returnsApiResponse() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("qa@example.com");
        request.setPassword("pass1234");

        when(clientIpExtractor.extractClientIp(any())).thenReturn("127.0.0.1");
        when(authService.authenticate(any(), any())).thenReturn(AuthenticationResponse.builder()
                .status("AUTHENTICATED")
                .accessToken("a")
                .refreshToken("r")
                .build());

        mockMvc.perform(post("/api/v1/auth/authenticate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("AUTHENTICATED"));
    }
}
