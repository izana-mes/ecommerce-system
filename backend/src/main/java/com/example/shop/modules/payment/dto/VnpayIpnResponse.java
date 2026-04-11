package com.example.shop.modules.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class VnpayIpnResponse {
    private String RspCode;
    private String Message;
}
