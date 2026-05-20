package com.example.shop.modules.payment.controller;

import com.example.shop.modules.payment.service.MomoPaymentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MomoPaymentController.class)
@AutoConfigureMockMvc(addFilters = false)
class MomoPaymentControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private MomoPaymentService momoPaymentService;

    @Test
    void handleIpn_returnsNoContent() throws Exception {
        mockMvc.perform(post("/api/payments/momo/ipn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderId\":\"ORD-1\"}"))
                .andExpect(status().isNoContent());
    }
}
