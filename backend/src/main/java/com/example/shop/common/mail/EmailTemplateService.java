package com.example.shop.common.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service to generate HTML email templates.
 * In a larger app, this might use Thymeleaf or FreeMarker.
 * For now, we use simple string construction for educational clarity.
 */
@Service
public class EmailTemplateService {

    @Value("${application.server.url:http://localhost:8080}")
    private String serverUrl;

    public String generateVerificationEmail(String name, String token) {
        String verifyUrl = serverUrl + "/api/v1/auth/verify-email?token=" + token;

        return String.format(
                """
                        <html>
                            <body>
                                <h2>Welcome, %s!</h2>
                                <p>Thank you for registering. Please click the link below to verify your email address:</p>
                                <p>
                                    <a href="%s" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                                </p>
                                <p>Or copy this link: %s</p>
                                <p>This link will expire in 24 hours.</p>
                            </body>
                        </html>
                        """,
                name, verifyUrl, verifyUrl);
    }

    public String generatePasswordResetEmail(String name, String token) {
        // In a real frontend app, this would link to a frontend page
        // For API-only, we provide the token

        return String.format("""
                <html>
                    <body>
                        <h2>Hello %s,</h2>
                        <p>We received a request to reset your password.</p>
                        <p>Use the following token to reset your password via the API:</p>
                        <h3 style="font-family: monospace; background-color: #f0f0f0; padding: 10px;">%s</h3>
                        <p>This token is valid for 1 hour.</p>
                        <p>If you did not request this, please ignore this email.</p>
                    </body>
                </html>
                """, name, token);
    }

    public String generateOtpEmail(String name, String otp) {
        return String.format(
                """
                        <html>
                            <body>
                                <h2>Hello %s,</h2>
                                <p>Your verification code is:</p>
                                <h1 style="letter-spacing: 4px; font-family: monospace;">%s</h1>
                                <p>This code will expire in 5 minutes.</p>
                                <p>If you didn’t request this, you can ignore this email.</p>
                            </body>
                        </html>
                        """,
                name == null ? "" : name,
                otp
        );
    }

    public String generateAttendancePolicyAlertEmail(
            String name,
            String title,
            String summary,
            String category,
            String reviewType
    ) {
        return String.format(
                """
                        <html>
                            <body>
                                <h2>Hello %s,</h2>
                                <p><strong>%s</strong></p>
                                <p>%s</p>
                                <p>Category: <strong>%s</strong></p>
                                <p>Review type: <strong>%s</strong></p>
                                <p>Please return to your shift, complete your hours, or contact your manager if this notice is unexpected.</p>
                            </body>
                        </html>
                        """,
                name == null ? "" : name,
                title == null ? "Attendance notice" : title,
                summary == null ? "" : summary,
                category == null ? "ATTENDANCE" : category,
                reviewType == null ? "WARNING" : reviewType
        );
    }

    public String generateCouponIssuedEmail(
            String name,
            String couponTitle,
            String couponCode,
            String notificationTitle,
            String notificationMessage,
            String redeemUrl,
            String expiresAt
    ) {
        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111;">
                                <h2>Hello %s,</h2>
                                <p><strong>%s</strong></p>
                                <p>%s</p>
                                <p>Coupon: <strong>%s</strong></p>
                                <p>Code: <strong style="font-family: monospace;">%s</strong></p>
                                <p>
                                    <a href="%s" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 12px 18px; text-decoration: none; border-radius: 6px;">Redeem Coupon</a>
                                </p>
                                <p>Or copy this link: %s</p>
                                <p>%s</p>
                            </body>
                        </html>
                        """,
                escapeHtml(name == null || name.isBlank() ? "there" : name),
                escapeHtml(notificationTitle == null || notificationTitle.isBlank() ? "A new coupon has been issued to your account." : notificationTitle),
                escapeHtml(notificationMessage == null || notificationMessage.isBlank() ? "Click the link below to open your coupon redemption page." : notificationMessage),
                escapeHtml(couponTitle == null || couponTitle.isBlank() ? "Discount voucher" : couponTitle),
                escapeHtml(couponCode),
                escapeHtml(redeemUrl),
                escapeHtml(redeemUrl),
                escapeHtml(expiresAt == null || expiresAt.isBlank() ? "Use this coupon before it expires." : "Expires on " + expiresAt + ".")
        );
    }

    public String generateSupplierAccessReviewEmail(
            String name,
            boolean approved,
            String businessName,
            String reviewerNote
    ) {
        String decision = approved ? "approved" : "rejected";
        String title = approved ? "Your supplier access request has been approved" : "Your supplier access request has been rejected";
        String summary = approved
                ? "You can now access supplier features and manage your supplier website listings."
                : "Your request was not approved at this time.";
        String noteSection = String.format(
                "<p><strong>Admin note:</strong> %s</p>",
                escapeHtml(reviewerNote == null || reviewerNote.isBlank() ? "No additional note was provided." : reviewerNote)
        );

        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111;">
                                <h2>Hello %s,</h2>
                                <p>%s</p>
                                <p>Your request to become a supplier for <strong>%s</strong> has been <strong>%s</strong>.</p>
                                <p>%s</p>
                                %s
                            </body>
                        </html>
                        """,
                escapeHtml(name == null || name.isBlank() ? "there" : name),
                escapeHtml(title),
                escapeHtml(businessName == null || businessName.isBlank() ? "your business" : businessName),
                escapeHtml(decision),
                escapeHtml(summary),
                noteSection
        );
    }

    public String generateSupplierAccessSubmissionEmail(
            String requesterName,
            String requesterEmail,
            String businessName,
            String websiteUrl,
            String contactPhone,
            String requestNote
    ) {
        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111;">
                                <h2>New supplier access request</h2>
                                <p>A user has requested supplier access and is waiting for admin review.</p>
                                <p><strong>Applicant:</strong> %s</p>
                                <p><strong>Email:</strong> %s</p>
                                <p><strong>Business name:</strong> %s</p>
                                <p><strong>Website:</strong> %s</p>
                                <p><strong>Contact phone:</strong> %s</p>
                                <p><strong>Request note:</strong> %s</p>
                            </body>
                        </html>
                        """,
                escapeHtml(requesterName == null || requesterName.isBlank() ? "Unknown user" : requesterName),
                escapeHtml(requesterEmail == null || requesterEmail.isBlank() ? "Not provided" : requesterEmail),
                escapeHtml(businessName == null || businessName.isBlank() ? "Not provided" : businessName),
                escapeHtml(websiteUrl == null || websiteUrl.isBlank() ? "Not provided" : websiteUrl),
                escapeHtml(contactPhone == null || contactPhone.isBlank() ? "Not provided" : contactPhone),
                escapeHtml(requestNote == null || requestNote.isBlank() ? "No note provided." : requestNote)
        );
    }

    public String generateSellerAccessReviewEmail(
            String name,
            boolean approved,
            String businessName,
            String reviewerNote
    ) {
        String decision = approved ? "approved" : "rejected";
        String title = approved ? "Your seller access request has been approved" : "Your seller access request has been rejected";
        String summary = approved
                ? "You can now access seller features and manage your seller website listings."
                : "Your request was not approved at this time.";
        String noteSection = String.format(
                "<p><strong>Admin note:</strong> %s</p>",
                escapeHtml(reviewerNote == null || reviewerNote.isBlank() ? "No additional note was provided." : reviewerNote)
        );

        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111;">
                                <h2>Hello %s,</h2>
                                <p>%s</p>
                                <p>Your request to become a seller for <strong>%s</strong> has been <strong>%s</strong>.</p>
                                <p>%s</p>
                                %s
                            </body>
                        </html>
                        """,
                escapeHtml(name == null || name.isBlank() ? "there" : name),
                escapeHtml(title),
                escapeHtml(businessName == null || businessName.isBlank() ? "your business" : businessName),
                escapeHtml(decision),
                escapeHtml(summary),
                noteSection
        );
    }

    public String generateSellerAccessSubmissionEmail(
            String requesterName,
            String requesterEmail,
            String businessName,
            String websiteUrl,
            String contactPhone,
            String requestNote
    ) {
        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111;">
                                <h2>New seller access request</h2>
                                <p>A user has requested seller access and is waiting for admin review.</p>
                                <p><strong>Applicant:</strong> %s</p>
                                <p><strong>Email:</strong> %s</p>
                                <p><strong>Business name:</strong> %s</p>
                                <p><strong>Website:</strong> %s</p>
                                <p><strong>Contact phone:</strong> %s</p>
                                <p><strong>Request note:</strong> %s</p>
                            </body>
                        </html>
                        """,
                escapeHtml(requesterName == null || requesterName.isBlank() ? "Unknown user" : requesterName),
                escapeHtml(requesterEmail == null || requesterEmail.isBlank() ? "Not provided" : requesterEmail),
                escapeHtml(businessName == null || businessName.isBlank() ? "Not provided" : businessName),
                escapeHtml(websiteUrl == null || websiteUrl.isBlank() ? "Not provided" : websiteUrl),
                escapeHtml(contactPhone == null || contactPhone.isBlank() ? "Not provided" : contactPhone),
                escapeHtml(requestNote == null || requestNote.isBlank() ? "No note provided." : requestNote)
        );
    }

    public String generateProductChangeReviewEmail(
            String name,
            boolean approved,
            String actionLabel,
            String productLabel,
            String reviewerNote
    ) {
        String decision = approved ? "approved" : "rejected";
        String title = approved ? "Your product submission has been approved" : "Your product submission has been rejected";
        String summary = approved
                ? "The product request has been accepted for inclusion on the supplier website."
                : "The product request was not accepted for inclusion on the supplier website.";
        String noteSection = String.format(
                "<p><strong>Admin note:</strong> %s</p>",
                escapeHtml(reviewerNote == null || reviewerNote.isBlank() ? "No additional note was provided." : reviewerNote)
        );

        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111;">
                                <h2>Hello %s,</h2>
                                <p>%s</p>
                                <p>Your product request for <strong>%s</strong> (%s) has been <strong>%s</strong>.</p>
                                <p>%s</p>
                                %s
                            </body>
                        </html>
                        """,
                escapeHtml(name == null || name.isBlank() ? "there" : name),
                escapeHtml(title),
                escapeHtml(productLabel == null || productLabel.isBlank() ? "your product" : productLabel),
                escapeHtml(actionLabel == null || actionLabel.isBlank() ? "request" : actionLabel),
                escapeHtml(decision),
                escapeHtml(summary),
                noteSection
        );
    }

    public String generateProductChangeRequestedEmail(
            String name,
            String actionLabel,
            String productLabel,
            String reviewerNote
    ) {
        String title = "Changes requested for your product submission";
        String summary = "The admin has requested corrections before this request can be approved. Please review the feedback below, make the necessary updates, and resubmit.";
        String noteSection = String.format(
                "<p><strong>Admin feedback:</strong> %s</p>",
                escapeHtml(reviewerNote == null || reviewerNote.isBlank() ? "No additional note was provided." : reviewerNote)
        );

        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111;">
                                <h2>Hello %s,</h2>
                                <p>%s</p>
                                <p>Your product request for <strong>%s</strong> (%s) requires updates.</p>
                                <p>%s</p>
                                %s
                            </body>
                        </html>
                        """,
                escapeHtml(name == null || name.isBlank() ? "there" : name),
                escapeHtml(title),
                escapeHtml(productLabel == null || productLabel.isBlank() ? "your product" : productLabel),
                escapeHtml(actionLabel == null || actionLabel.isBlank() ? "request" : actionLabel),
                escapeHtml(summary),
                noteSection
        );
    }

    public String generateProductChangeSubmissionEmail(
            String requesterName,
            String requesterEmail,
            String actionLabel,
            String productLabel
    ) {
        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111;">
                                <h2>New supplier product submission</h2>
                                <p>A supplier has submitted a product request for admin approval.</p>
                                <p><strong>Supplier:</strong> %s</p>
                                <p><strong>Email:</strong> %s</p>
                                <p><strong>Request type:</strong> %s</p>
                                <p><strong>Product:</strong> %s</p>
                            </body>
                        </html>
                        """,
                escapeHtml(requesterName == null || requesterName.isBlank() ? "Unknown supplier" : requesterName),
                escapeHtml(requesterEmail == null || requesterEmail.isBlank() ? "Not provided" : requesterEmail),
                escapeHtml(actionLabel == null || actionLabel.isBlank() ? "product request" : actionLabel),
                escapeHtml(productLabel == null || productLabel.isBlank() ? "Submitted product" : productLabel)
        );
    }

    public String generateShipperAssignmentEmail(
            String shipperName,
            String orderNumber,
            String expectedDeliveryDate
    ) {
        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111;">
                                <h2>Hello %s,</h2>
                                <p>You have been assigned to deliver a new order.</p>
                                <p><strong>Order Number:</strong> %s</p>
                                %s
                                <p>Please review the details in your shipper dashboard.</p>
                            </body>
                        </html>
                        """,
                escapeHtml(shipperName == null || shipperName.isBlank() ? "there" : shipperName),
                escapeHtml(orderNumber == null ? "Unknown" : orderNumber),
                expectedDeliveryDate != null && !expectedDeliveryDate.isBlank() ? "<p><strong>Expected Delivery Date:</strong> " + escapeHtml(expectedDeliveryDate) + "</p>" : ""
        );
    }

    public String generateSellerNewOrderEmail(
            String sellerName,
            String orderNumber,
            String customerName,
            String itemsSummary,
            String orderUrl
    ) {
        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 24px; border-radius: 12px 12px 0 0;">
                                    <h2 style="color: #fff; margin: 0;">New Order Received!</h2>
                                </div>
                                <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                                    <p>Hello %s,</p>
                                    <p>A customer has placed an order containing items from your catalog:</p>
                                    <div style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 16px; margin: 18px 0; border-radius: 4px;">
                                        <p style="margin: 0 0 8px 0;"><strong>Order Number:</strong> %s</p>
                                        <p style="margin: 0 0 8px 0;"><strong>Customer:</strong> %s</p>
                                        <p style="margin: 0;"><strong>Items:</strong> %s</p>
                                    </div>
                                    <p>Please log in to your Seller Portal to review and prepare the order for shipment.</p>
                                    <div style="text-align: center; margin: 24px 0;">
                                        <a href="%s" style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                            Open Seller Portal Orders
                                        </a>
                                    </div>
                                    <p style="color: #64748b; font-size: 13px;">Or access: %s</p>
                                </div>
                            </body>
                        </html>
                        """,
                escapeHtml(sellerName == null || sellerName.isBlank() ? "Seller" : sellerName),
                escapeHtml(orderNumber == null ? "Unknown" : orderNumber),
                escapeHtml(customerName == null || customerName.isBlank() ? "Customer" : customerName),
                escapeHtml(itemsSummary == null || itemsSummary.isBlank() ? "Product items" : itemsSummary),
                escapeHtml(orderUrl == null ? "/seller/orders" : orderUrl),
                escapeHtml(orderUrl == null ? "/seller/orders" : orderUrl)
        );
    }

    public String generateOrderStatusUpdateEmail(
            String customerName,
            String orderNumber,
            String statusLabel,
            String statusColor,
            String statusDescription,
            String ordersUrl
    ) {
        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 24px; border-radius: 12px 12px 0 0;">
                                    <h2 style="color: #fff; margin: 0;">Order Status Update</h2>
                                </div>
                                <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                                    <p>Hi %s,</p>
                                    <p>Your order <strong>%s</strong> has been updated:</p>
                                    <div style="text-align: center; margin: 24px 0;">
                                        <span style="display: inline-block; background: %s; color: #fff; padding: 12px 32px; border-radius: 8px; font-size: 18px; font-weight: bold;">
                                            %s
                                        </span>
                                    </div>
                                    <p>%s</p>
                                    <div style="text-align: center; margin: 24px 0;">
                                        <a href="%s" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
                                            View Order Details
                                        </a>
                                    </div>
                                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                                    <p style="color: #6b7280; font-size: 12px;">If you have any questions, our support team is here to help.</p>
                                </div>
                            </body>
                        </html>
                        """,
                escapeHtml(customerName == null || customerName.isBlank() ? "Customer" : customerName),
                escapeHtml(orderNumber == null ? "Unknown" : orderNumber),
                escapeHtml(statusColor == null ? "#2563eb" : statusColor),
                escapeHtml(statusLabel == null ? "Updated" : statusLabel),
                escapeHtml(statusDescription == null ? "" : statusDescription),
                escapeHtml(ordersUrl == null ? "/orders" : ordersUrl)
        );
    }

    public String generatePaymentResultEmail(
            String customerName,
            String orderNumber,
            boolean success,
            String amount,
            String currency,
            String paymentMethod,
            String reason
    ) {
        String title = success ? "Payment Confirmed!" : "Payment Attempt Failed";
        String headerBg = success ? "linear-gradient(135deg, #15803d, #22c55e)" : "linear-gradient(135deg, #b91c1c, #ef4444)";
        String statusText = success
                ? "Your payment was processed successfully. Thank you for your purchase!"
                : "We were unable to process your payment for this order.";
        String reasonHtml = (!success && reason != null && !reason.isBlank())
                ? String.format("<p><strong>Reason:</strong> %s</p><p>Please check your payment information or select another payment method.</p>", escapeHtml(reason))
                : "";

        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
                                <div style="background: %s; padding: 24px; border-radius: 12px 12px 0 0;">
                                    <h2 style="color: #fff; margin: 0;">%s</h2>
                                </div>
                                <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                                    <p>Hello %s,</p>
                                    <p>%s</p>
                                    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 18px 0; border: 1px solid #f3f4f6;">
                                        <p style="margin: 0 0 8px 0;"><strong>Order:</strong> %s</p>
                                        <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> %s %s</p>
                                        <p style="margin: 0;"><strong>Payment Method:</strong> %s</p>
                                    </div>
                                    %s
                                    <div style="text-align: center; margin: 24px 0;">
                                        <a href="/orders" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                            View Your Orders
                                        </a>
                                    </div>
                                </div>
                            </body>
                        </html>
                        """,
                headerBg,
                escapeHtml(title),
                escapeHtml(customerName == null || customerName.isBlank() ? "Customer" : customerName),
                escapeHtml(statusText),
                escapeHtml(orderNumber == null ? "Unknown" : orderNumber),
                escapeHtml(amount == null ? "-" : amount),
                escapeHtml(currency == null ? "USD" : currency),
                escapeHtml(paymentMethod == null ? "Online" : paymentMethod),
                reasonHtml
        );
    }

    public String generateResaleRequestSubmittedEmail(
            String supplierName,
            String sellerName,
            String sellerEmail,
            String productName,
            String proposalMessage
    ) {
        String proposalBlock = (proposalMessage != null && !proposalMessage.isBlank())
                ? String.format("<p><strong>Seller's message:</strong> %s</p>", escapeHtml(proposalMessage))
                : "";

        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #1e293b, #334155); padding: 24px; border-radius: 12px 12px 0 0;">
                                    <h2 style="color: #fff; margin: 0;">New Product Resale Request</h2>
                                </div>
                                <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                                    <p>Hello %s,</p>
                                    <p>Seller <strong>%s</strong> (%s) has submitted a request to resell your product: <strong>%s</strong>.</p>
                                    %s
                                    <p>Please review their profile and proposal in your Supplier Portal to accept or reject this request.</p>
                                    <div style="text-align: center; margin: 24px 0;">
                                        <a href="/supplier/resale-requests" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                            Review Resale Request
                                        </a>
                                    </div>
                                </div>
                            </body>
                        </html>
                        """,
                escapeHtml(supplierName == null || supplierName.isBlank() ? "Supplier" : supplierName),
                escapeHtml(sellerName == null || sellerName.isBlank() ? "A seller" : sellerName),
                escapeHtml(sellerEmail == null ? "" : sellerEmail),
                escapeHtml(productName == null ? "your product" : productName),
                proposalBlock
        );
    }

    public String generateResaleRequestAcceptedEmail(
            String sellerName,
            String supplierName,
            String productName,
            String note
    ) {
        String noteBlock = (note != null && !note.isBlank())
                ? String.format("<p><strong>Supplier's note:</strong> %s</p>", escapeHtml(note))
                : "";

        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #15803d, #22c55e); padding: 24px; border-radius: 12px 12px 0 0;">
                                    <h2 style="color: #fff; margin: 0;">Resale Request Approved! 🎉</h2>
                                </div>
                                <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                                    <p>Hello %s,</p>
                                    <p>Great news! Supplier <strong>%s</strong> has accepted your request to resell <strong>%s</strong>.</p>
                                    %s
                                    <p>Your resale authorization is now active. You can create your storefront listing anytime from your Seller Portal.</p>
                                    <div style="text-align: center; margin: 24px 0;">
                                        <a href="/seller/partnerships" style="display: inline-block; background-color: #15803d; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                            View Active Partnerships
                                        </a>
                                    </div>
                                </div>
                            </body>
                        </html>
                        """,
                escapeHtml(sellerName == null || sellerName.isBlank() ? "Seller" : sellerName),
                escapeHtml(supplierName == null || supplierName.isBlank() ? "The supplier" : supplierName),
                escapeHtml(productName == null ? "the product" : productName),
                noteBlock
        );
    }

    public String generateResaleRequestRejectedEmail(
            String sellerName,
            String supplierName,
            String productName,
            String reason
    ) {
        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #b91c1c, #ef4444); padding: 24px; border-radius: 12px 12px 0 0;">
                                    <h2 style="color: #fff; margin: 0;">Resale Request Update</h2>
                                </div>
                                <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                                    <p>Hello %s,</p>
                                    <p>Supplier <strong>%s</strong> has reviewed your request to resell <strong>%s</strong> and was unable to approve it at this time.</p>
                                    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0;">
                                        <p style="margin: 0;"><strong>Reason:</strong> %s</p>
                                    </div>
                                    <p>You can discover other supplier products to resell in the Supplier Catalog.</p>
                                    <div style="text-align: center; margin: 24px 0;">
                                        <a href="/seller/supplier-catalog" style="display: inline-block; background-color: #1e293b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                            Browse Catalog
                                        </a>
                                    </div>
                                </div>
                            </body>
                        </html>
                        """,
                escapeHtml(sellerName == null || sellerName.isBlank() ? "Seller" : sellerName),
                escapeHtml(supplierName == null || supplierName.isBlank() ? "The supplier" : supplierName),
                escapeHtml(productName == null ? "the product" : productName),
                escapeHtml(reason == null ? "No reason specified" : reason)
        );
    }

    public String generateResaleRequestCancelledEmail(
            String supplierName,
            String sellerName,
            String productName,
            String cancelReason
    ) {
        String reasonBlock = (cancelReason != null && !cancelReason.isBlank())
                ? String.format("<p><strong>Reason:</strong> %s</p>", escapeHtml(cancelReason))
                : "";

        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
                                <div style="background: #475569; padding: 24px; border-radius: 12px 12px 0 0;">
                                    <h2 style="color: #fff; margin: 0;">Resale Request Cancelled</h2>
                                </div>
                                <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                                    <p>Hello %s,</p>
                                    <p>Seller <strong>%s</strong> has cancelled their resale request for <strong>%s</strong>.</p>
                                    %s
                                </div>
                            </body>
                        </html>
                        """,
                escapeHtml(supplierName == null || supplierName.isBlank() ? "Supplier" : supplierName),
                escapeHtml(sellerName == null || sellerName.isBlank() ? "Seller" : sellerName),
                escapeHtml(productName == null ? "the product" : productName),
                reasonBlock
        );
    }

    public String generateResaleAuthorizationRevokedEmail(
            String sellerName,
            String supplierName,
            String productName,
            String reason
    ) {
        return String.format(
                """
                        <html>
                            <body style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #c2410c, #f97316); padding: 24px; border-radius: 12px 12px 0 0;">
                                    <h2 style="color: #fff; margin: 0;">Resale Authorization Revoked</h2>
                                </div>
                                <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                                    <p>Hello %s,</p>
                                    <p>Your authorization to resell <strong>%s</strong> from supplier <strong>%s</strong> has been revoked.</p>
                                    <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 12px; margin: 16px 0;">
                                        <p style="margin: 0;"><strong>Reason:</strong> %s</p>
                                    </div>
                                    <p>Any active seller listings associated with this product have been deactivated automatically. Existing customer orders remain unaffected.</p>
                                </div>
                            </body>
                        </html>
                        """,
                escapeHtml(sellerName == null || sellerName.isBlank() ? "Seller" : sellerName),
                escapeHtml(productName == null ? "the product" : productName),
                escapeHtml(supplierName == null || supplierName.isBlank() ? "Supplier" : supplierName),
                escapeHtml(reason == null ? "No reason specified" : reason)
        );
    }

    private String escapeHtml(String value) {
        return (value == null ? "" : value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
