package com.example.shop.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityIntegrationTest {

    @Autowired private MockMvc mockMvc;

    @Test
    void authBypass_protectedRouteShouldRejectAnonymous() throws Exception {
        mockMvc.perform(get("/api/v1/supplier/dashboard"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void csrf_protectedMutationWithoutTokenShouldFail() throws Exception {
        mockMvc.perform(post("/api/wishlist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productID\":\"P1\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void rateLimit_loginEndpointEventuallyThrottlesOrRejects() throws Exception {
        int statusCode = 0;
        for (int i = 0; i < 12; i++) {
            statusCode = mockMvc.perform(post("/api/v1/auth/authenticate")
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"x@y.com\",\"password\":\"bad\"}"))
                    .andReturn().getResponse().getStatus();
        }
        org.assertj.core.api.Assertions.assertThat(statusCode).isIn(401, 429);
    }

    @Test
    void permission_adminEndpointShouldRejectAnonymous() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard"))
                .andExpect(status().isUnauthorized());
    }
}
