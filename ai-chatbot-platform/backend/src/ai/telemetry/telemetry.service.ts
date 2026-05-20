import { logger } from "../../utils/logger.js";

const counters = new Map<string, number>();

export function incMetric(name: string, labels: Record<string, string> = {}) {
  const key = `${name}:${JSON.stringify(labels)}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

export function observeMetric(name: string, value: number, labels: Record<string, string> = {}) {
  logger.info({ event: "metric_observation", name, value, labels });
}

export function snapshotMetrics() {
  return Array.from(counters.entries()).map(([key, value]) => ({ key, value }));
}
