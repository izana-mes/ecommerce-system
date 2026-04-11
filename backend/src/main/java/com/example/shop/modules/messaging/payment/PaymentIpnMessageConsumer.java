package com.example.shop.modules.messaging.payment;

import com.example.shop.config.ConditionalOnRabbitEnabled;
import com.example.shop.modules.messaging.email.EmailMessage;
import com.example.shop.modules.messaging.email.EmailMessagePublisher;
import com.example.shop.modules.payment.dto.VnpayIpnResponse;
import com.example.shop.modules.payment.service.VnpayPaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnRabbitEnabled
@Slf4j
public class PaymentIpnMessageConsumer {

    private final VnpayPaymentService vnpayPaymentService;
    private final EmailMessagePublisher emailMessagePublisher;

    @Value("${application.bootstrap.admin.email:admin@example.com}")
    private String adminEmail;

    @RabbitListener(queues = "${application.messaging.queue.payment-ipn}")
    public void consume(VnpayIpnMessage message) {
        if (message == null || message.getParams() == null || message.getParams().isEmpty()) {
            log.warn("Received empty payment IPN message");
            return;
        }

        VnpayIpnResponse response = vnpayPaymentService.processIpn(message.getParams());
        if ("00".equals(response.getRspCode())
                || "02".equals(response.getRspCode())
                || "97".equals(response.getRspCode())
                || "01".equals(response.getRspCode())
                || "04".equals(response.getRspCode())) {
            log.info("Processed VNPAY IPN event with code {}", response.getRspCode());

            // Alert admin on non-success payment codes
            if (!"00".equals(response.getRspCode())) {
                sendFailedPaymentAlert(response, message);
            }
            return;
        }

        // Alert admin for unexpected failure codes
        sendFailedPaymentAlert(response, message);
        throw new IllegalStateException("IPN processing failed: " + response.getRspCode() + " - " + response.getMessage());
    }

    private void sendFailedPaymentAlert(VnpayIpnResponse response, VnpayIpnMessage message) {
        try {
            String txnRef = message.getParams().getOrDefault("vnp_TxnRef", "unknown");
            String amount = message.getParams().getOrDefault("vnp_Amount", "0");

            String content = """
                    <html>
                      <body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;">
                        <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:24px;border-radius:12px 12px 0 0;">
                          <h2 style="color:#fff;margin:0;">⚠️ Payment Processing Issue</h2>
                        </div>
                        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
                          <table style="width:100%%;border-collapse:collapse;">
                            <tr><td style="padding:8px;font-weight:bold;">Transaction Ref</td><td style="padding:8px;">%s</td></tr>
                            <tr><td style="padding:8px;font-weight:bold;">Response Code</td><td style="padding:8px;color:#dc2626;font-weight:bold;">%s</td></tr>
                            <tr><td style="padding:8px;font-weight:bold;">Message</td><td style="padding:8px;">%s</td></tr>
                            <tr><td style="padding:8px;font-weight:bold;">Amount</td><td style="padding:8px;">%s</td></tr>
                          </table>
                          <p style="color:#6b7280;font-size:12px;margin-top:16px;">Please investigate this payment in the admin panel.</p>
                        </div>
                      </body>
                    </html>
                    """.formatted(txnRef, response.getRspCode(), response.getMessage(), amount);

            emailMessagePublisher.publish(EmailMessage.builder()
                    .to(adminEmail)
                    .subject("⚠️ Failed Payment Alert - Txn " + txnRef)
                    .content(content)
                    .emailType(EmailMessage.EmailType.GENERIC)
                    .build());

            log.info("Failed payment alert sent for txn {}", txnRef);
        } catch (Exception e) {
            log.error("Failed to send payment alert email", e);
        }
    }
}

