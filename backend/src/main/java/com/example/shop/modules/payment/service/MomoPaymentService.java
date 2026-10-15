package com.example.shop.modules.payment.service;

import com.example.shop.modules.payment.momo.dto.MomoCreatePaymentResponse;
import com.example.shop.modules.payment.momo.dto.MomoPaymentStatusResponse;
import com.example.shop.modules.user.entity.User;

import java.util.Map;

public interface MomoPaymentService {

    /**
     * Create a MoMo payment request server-side and return the payUrl.
     * The order amount is verified against the database.
     *
     * @param orderNumber the internal shop order number
     * @param user optional authenticated user (for ownership validation)
     * @return MomoCreatePaymentResponse containing payUrl
     */
    MomoCreatePaymentResponse createPayment(String orderNumber, User user);

    /**
     * Process asynchronous server-to-server IPN callback from MoMo.
     *
     * @param payload IPN body from MoMo
     */
    void processIpn(Map<String, Object> payload);

    /**
     * Get the payment status for an order from DB.
     *
     * @param orderNumber the internal shop order number
     * @return payment status response
     */
    MomoPaymentStatusResponse getPaymentStatus(String orderNumber);

    /**
     * Process browser return/redirect parameters.
     * Validates redirect signature and verifies payment state idempotently.
     *
     * @param params parameters from MoMo return URL
     * @return true if payment is confirmed as paid, false otherwise
     */
    boolean processRedirect(Map<String, Object> params);

    /**
     * Actively query MoMo gateway server-to-server for transaction status.
     * Useful when redirect fires before IPN or when IPN was dropped.
     *
     * @param orderNumber the internal shop order number
     * @return updated payment status response
     */
    MomoPaymentStatusResponse queryMomoTransaction(String orderNumber);
}
