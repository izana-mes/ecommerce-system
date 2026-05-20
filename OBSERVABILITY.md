# Observability Stack

## Components
- Metrics: Prometheus + Spring Actuator + MCP Prometheus endpoint
- Logs: JSON structured logs (Spring + MCP) collected with Promtail into Loki
- Traces: OpenTelemetry from Spring Boot exported to Tempo
- Dashboards: Grafana with provisioned Prometheus/Loki/Tempo datasources
- Alerts: Prometheus alert rules for errors, payment failures, AI tool failures, DB latency, memory, rate limits

## Files Added
- `observability/docker-compose.monitoring.yml`
- `observability/prometheus/prometheus.yml`
- `observability/prometheus/alerts.yml`
- `observability/loki/loki-config.yml`
- `observability/promtail/promtail-config.yml`
- `observability/tempo/tempo.yml`
- `observability/grafana/provisioning/datasources/datasources.yml`
- `observability/grafana/provisioning/dashboards/dashboards.yml`
- `observability/grafana/dashboards/platform-overview.json`

## App Instrumentation
- Backend:
  - Prometheus actuator endpoint: `/actuator/prometheus`
  - OTel tracing export via `OTEL_EXPORTER_OTLP_ENDPOINT`
  - Structured JSON logging via `backend/src/main/resources/logback-spring.xml`
  - Custom metrics for:
    - rate limits
    - payment IPN status/latency
    - AI request latency/errors
    - AI token usage
    - AI tool execution latency/failures
    - hallucinated tool calls

- MCP server:
  - `/metrics` endpoint using `prom-client`
  - per-tool success/failure counters and latency histograms
  - request/correlation IDs in logs and response headers

- Frontend:
  - request ID + correlation ID headers set in Next middleware
  - structured request log event emitted in middleware

## Run
1. Start platform services:
   - `docker compose up -d`
2. Start monitoring stack:
   - `docker compose -f observability/docker-compose.monitoring.yml up -d`
3. Open:
   - Grafana: `http://localhost:3001` (admin/admin)
   - Prometheus: `http://localhost:9090`
   - Loki: `http://localhost:3101`
   - Tempo: `http://localhost:3200`

## Notes
- Postgres exporter DSN is currently set to `postgres/postgres/shop` in monitoring compose; adjust if your DB credentials differ.
- Redis/Postgres exporters scrape host-level ports (`host.docker.internal`) for local development.
