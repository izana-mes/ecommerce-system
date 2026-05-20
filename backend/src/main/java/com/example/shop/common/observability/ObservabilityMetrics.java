package com.example.shop.common.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class ObservabilityMetrics {

    private final MeterRegistry meterRegistry;

    public ObservabilityMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public void recordRateLimit(String ruleName, boolean blocked) {
        Counter.builder("rate_limit.requests.total")
                .tag("rule", ruleName)
                .tag("blocked", String.valueOf(blocked))
                .register(meterRegistry)
                .increment();
    }

    public void recordPaymentIpn(String provider, String status, long durationMs) {
        Counter.builder("payment.ipn.events.total")
                .tag("provider", provider)
                .tag("status", status)
                .register(meterRegistry)
                .increment();

        Timer.builder("payment.ipn.processing.latency")
                .tag("provider", provider)
                .register(meterRegistry)
                .record(durationMs, TimeUnit.MILLISECONDS);
    }

    public void recordAiRequest(String model, String status, long durationMs) {
        Counter.builder("ai.requests.total")
                .tag("model", model)
                .tag("status", status)
                .register(meterRegistry)
                .increment();

        Timer.builder("ai.request.latency")
                .tag("model", model)
                .tag("status", status)
                .register(meterRegistry)
                .record(durationMs, TimeUnit.MILLISECONDS);
    }

    public void recordAiTokens(String model, String type, double count) {
        Counter.builder("ai.tokens.usage.total")
                .tag("model", model)
                .tag("type", type)
                .register(meterRegistry)
                .increment(count);
    }

    public void recordAiToolExecution(String toolName, String status, long durationMs) {
        Counter.builder("ai.tool.executions.total")
                .tag("tool", toolName)
                .tag("status", status)
                .register(meterRegistry)
                .increment();

        Timer.builder("mcp.tool.execution.latency")
                .tag("tool", toolName)
                .tag("status", status)
                .register(meterRegistry)
                .record(durationMs, TimeUnit.MILLISECONDS);
    }

    public void recordAiModelError(String model, String reason) {
        Counter.builder("ai.model.errors.total")
                .tag("model", model)
                .tag("reason", reason)
                .register(meterRegistry)
                .increment();
    }

    public void recordAiHallucinatedToolCall(String toolName) {
        Counter.builder("ai.tool.hallucinated_calls.total")
                .tag("tool", toolName)
                .register(meterRegistry)
                .increment();
    }

    public void recordAiContextSize(String model, int contextChars) {
        DistributionSummary.builder("ai.context.size.chars")
                .tag("model", model)
                .register(meterRegistry)
                .record(contextChars);
    }
}
