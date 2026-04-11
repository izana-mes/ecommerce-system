package com.example.shop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
@EnableRabbit
@ConditionalOnRabbitEnabled
public class RabbitMqConfig {

    @Value("${application.messaging.exchange}")
    private String exchangeName;

    // ── Payment IPN ──────────────────────────────────────────────
    @Value("${application.messaging.queue.payment-ipn}")
    private String paymentIpnQueue;

    @Value("${application.messaging.queue.payment-ipn-dlq}")
    private String paymentIpnDlq;

    @Value("${application.messaging.routing-key.payment-ipn}")
    private String paymentIpnRoutingKey;

    // ── Order Paid Email ─────────────────────────────────────────
    @Value("${application.messaging.queue.order-paid-email}")
    private String orderPaidEmailQueue;

    @Value("${application.messaging.queue.order-paid-email-dlq}")
    private String orderPaidEmailDlq;

    @Value("${application.messaging.routing-key.order-paid-email}")
    private String orderPaidEmailRoutingKey;

    // ── Order Created ────────────────────────────────────────────
    @Value("${application.messaging.queue.order-created}")
    private String orderCreatedQueue;

    @Value("${application.messaging.queue.order-created-dlq}")
    private String orderCreatedDlq;

    @Value("${application.messaging.routing-key.order-created}")
    private String orderCreatedRoutingKey;

    // ── Email General ────────────────────────────────────────────
    @Value("${application.messaging.queue.email-general}")
    private String emailGeneralQueue;

    @Value("${application.messaging.queue.email-general-dlq}")
    private String emailGeneralDlq;

    @Value("${application.messaging.routing-key.email-general}")
    private String emailGeneralRoutingKey;

    // ── Low Stock Alert ──────────────────────────────────────────
    @Value("${application.messaging.queue.low-stock-alert}")
    private String lowStockAlertQueue;

    @Value("${application.messaging.queue.low-stock-alert-dlq}")
    private String lowStockAlertDlq;

    @Value("${application.messaging.routing-key.low-stock-alert}")
    private String lowStockAlertRoutingKey;

    // ── Exchanges ────────────────────────────────────────────────

    @Bean
    public TopicExchange shopEventsExchange() {
        return ExchangeBuilder.topicExchange(exchangeName).durable(true).build();
    }

    @Bean
    public DirectExchange shopDlqExchange() {
        return ExchangeBuilder.directExchange(exchangeName + ".dlq").durable(true).build();
    }

    // ── Payment IPN queue/binding ────────────────────────────────

    @Bean
    public Queue paymentIpnQueue() {
        return QueueBuilder.durable(paymentIpnQueue)
                .withArguments(dlqArgs(paymentIpnDlq))
                .build();
    }

    @Bean
    public Queue paymentIpnDlq() {
        return QueueBuilder.durable(paymentIpnDlq).build();
    }

    @Bean
    public Binding paymentIpnBinding(Queue paymentIpnQueue, TopicExchange shopEventsExchange) {
        return BindingBuilder.bind(paymentIpnQueue).to(shopEventsExchange).with(paymentIpnRoutingKey);
    }

    @Bean
    public Binding paymentIpnDlqBinding(Queue paymentIpnDlq, DirectExchange shopDlqExchange) {
        return BindingBuilder.bind(paymentIpnDlq).to(shopDlqExchange).with(paymentIpnDlq.getName());
    }

    // ── Order Paid Email queue/binding ───────────────────────────

    @Bean
    public Queue orderPaidEmailQueue() {
        return QueueBuilder.durable(orderPaidEmailQueue)
                .withArguments(dlqArgs(orderPaidEmailDlq))
                .build();
    }

    @Bean
    public Queue orderPaidEmailDlq() {
        return QueueBuilder.durable(orderPaidEmailDlq).build();
    }

    @Bean
    public Binding orderPaidEmailBinding(Queue orderPaidEmailQueue, TopicExchange shopEventsExchange) {
        return BindingBuilder.bind(orderPaidEmailQueue).to(shopEventsExchange).with(orderPaidEmailRoutingKey);
    }

    @Bean
    public Binding orderPaidEmailDlqBinding(Queue orderPaidEmailDlq, DirectExchange shopDlqExchange) {
        return BindingBuilder.bind(orderPaidEmailDlq).to(shopDlqExchange).with(orderPaidEmailDlq.getName());
    }

    // ── Order Created queue/binding ─────────────────────────────

    @Bean
    public Queue orderCreatedQueue() {
        return QueueBuilder.durable(orderCreatedQueue)
                .withArguments(dlqArgs(orderCreatedDlq))
                .build();
    }

    @Bean
    public Queue orderCreatedDlq() {
        return QueueBuilder.durable(orderCreatedDlq).build();
    }

    @Bean
    public Binding orderCreatedBinding(Queue orderCreatedQueue, TopicExchange shopEventsExchange) {
        return BindingBuilder.bind(orderCreatedQueue).to(shopEventsExchange).with(orderCreatedRoutingKey);
    }

    @Bean
    public Binding orderCreatedDlqBinding(Queue orderCreatedDlq, DirectExchange shopDlqExchange) {
        return BindingBuilder.bind(orderCreatedDlq).to(shopDlqExchange).with(orderCreatedDlq.getName());
    }

    // ── Email General queue/binding ─────────────────────────────

    @Bean
    public Queue emailGeneralQueue() {
        return QueueBuilder.durable(emailGeneralQueue)
                .withArguments(dlqArgs(emailGeneralDlq))
                .build();
    }

    @Bean
    public Queue emailGeneralDlq() {
        return QueueBuilder.durable(emailGeneralDlq).build();
    }

    @Bean
    public Binding emailGeneralBinding(Queue emailGeneralQueue, TopicExchange shopEventsExchange) {
        return BindingBuilder.bind(emailGeneralQueue).to(shopEventsExchange).with(emailGeneralRoutingKey);
    }

    @Bean
    public Binding emailGeneralDlqBinding(Queue emailGeneralDlq, DirectExchange shopDlqExchange) {
        return BindingBuilder.bind(emailGeneralDlq).to(shopDlqExchange).with(emailGeneralDlq.getName());
    }

    // ── Low Stock Alert queue/binding ───────────────────────────

    @Bean
    public Queue lowStockAlertQueue() {
        return QueueBuilder.durable(lowStockAlertQueue)
                .withArguments(dlqArgs(lowStockAlertDlq))
                .build();
    }

    @Bean
    public Queue lowStockAlertDlq() {
        return QueueBuilder.durable(lowStockAlertDlq).build();
    }

    @Bean
    public Binding lowStockAlertBinding(Queue lowStockAlertQueue, TopicExchange shopEventsExchange) {
        return BindingBuilder.bind(lowStockAlertQueue).to(shopEventsExchange).with(lowStockAlertRoutingKey);
    }

    @Bean
    public Binding lowStockAlertDlqBinding(Queue lowStockAlertDlq, DirectExchange shopDlqExchange) {
        return BindingBuilder.bind(lowStockAlertDlq).to(shopDlqExchange).with(lowStockAlertDlq.getName());
    }

    // ── Order Status Changed queue/binding ──────────────────────

    @Value("${application.messaging.queue.order-status-changed}")
    private String orderStatusChangedQueue;

    @Value("${application.messaging.queue.order-status-changed-dlq}")
    private String orderStatusChangedDlq;

    @Value("${application.messaging.routing-key.order-status-changed}")
    private String orderStatusChangedRoutingKey;

    @Bean
    public Queue orderStatusChangedQueue() {
        return QueueBuilder.durable(orderStatusChangedQueue)
                .withArguments(dlqArgs(orderStatusChangedDlq))
                .build();
    }

    @Bean
    public Queue orderStatusChangedDlq() {
        return QueueBuilder.durable(orderStatusChangedDlq).build();
    }

    @Bean
    public Binding orderStatusChangedBinding(Queue orderStatusChangedQueue, TopicExchange shopEventsExchange) {
        return BindingBuilder.bind(orderStatusChangedQueue).to(shopEventsExchange).with(orderStatusChangedRoutingKey);
    }

    @Bean
    public Binding orderStatusChangedDlqBinding(Queue orderStatusChangedDlq, DirectExchange shopDlqExchange) {
        return BindingBuilder.bind(orderStatusChangedDlq).to(shopDlqExchange).with(orderStatusChangedDlq.getName());
    }

    // ── Review Submitted queue/binding ──────────────────────────

    @Value("${application.messaging.queue.review-submitted}")
    private String reviewSubmittedQueue;

    @Value("${application.messaging.queue.review-submitted-dlq}")
    private String reviewSubmittedDlq;

    @Value("${application.messaging.routing-key.review-submitted}")
    private String reviewSubmittedRoutingKey;

    @Bean
    public Queue reviewSubmittedQueue() {
        return QueueBuilder.durable(reviewSubmittedQueue)
                .withArguments(dlqArgs(reviewSubmittedDlq))
                .build();
    }

    @Bean
    public Queue reviewSubmittedDlq() {
        return QueueBuilder.durable(reviewSubmittedDlq).build();
    }

    @Bean
    public Binding reviewSubmittedBinding(Queue reviewSubmittedQueue, TopicExchange shopEventsExchange) {
        return BindingBuilder.bind(reviewSubmittedQueue).to(shopEventsExchange).with(reviewSubmittedRoutingKey);
    }

    @Bean
    public Binding reviewSubmittedDlqBinding(Queue reviewSubmittedDlq, DirectExchange shopDlqExchange) {
        return BindingBuilder.bind(reviewSubmittedDlq).to(shopDlqExchange).with(reviewSubmittedDlq.getName());
    }

    // ── Audit Event queue/binding ───────────────────────────────

    @Value("${application.messaging.queue.audit-event}")
    private String auditEventQueue;

    @Value("${application.messaging.queue.audit-event-dlq}")
    private String auditEventDlq;

    @Value("${application.messaging.routing-key.audit-event}")
    private String auditEventRoutingKey;

    @Bean
    public Queue auditEventQueue() {
        return QueueBuilder.durable(auditEventQueue)
                .withArguments(dlqArgs(auditEventDlq))
                .build();
    }

    @Bean
    public Queue auditEventDlq() {
        return QueueBuilder.durable(auditEventDlq).build();
    }

    @Bean
    public Binding auditEventBinding(Queue auditEventQueue, TopicExchange shopEventsExchange) {
        return BindingBuilder.bind(auditEventQueue).to(shopEventsExchange).with(auditEventRoutingKey);
    }

    @Bean
    public Binding auditEventDlqBinding(Queue auditEventDlq, DirectExchange shopDlqExchange) {
        return BindingBuilder.bind(auditEventDlq).to(shopDlqExchange).with(auditEventDlq.getName());
    }

    // ── Message converter & template ────────────────────────────

    @Bean
    public Jackson2JsonMessageConverter rabbitMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         Jackson2JsonMessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        return template;
    }

    // ── Helpers ──────────────────────────────────────────────────

    private Map<String, Object> dlqArgs(String dlqName) {
        return Map.of(
                "x-dead-letter-exchange", exchangeName + ".dlq",
                "x-dead-letter-routing-key", dlqName
        );
    }
}

