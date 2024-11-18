import { Gauge, Counter, Histogram } from 'prom-client';

const metrics = {};

export function createMetrics(metricDefinitions) {
  for (const [name, definition] of Object.entries(metricDefinitions)) {
    switch (definition.type) {
      case 'gauge':
        metrics[name] = new Gauge({
          name,
          help: definition.help
        });
        break;
      case 'counter':
        metrics[name] = new Counter({
          name,
          help: definition.help
        });
        break;
      case 'histogram':
        metrics[name] = new Histogram({
          name,
          help: definition.help,
          buckets: [0.1, 0.5, 1, 2.5, 5, 7.5, 10]
        });
        break;
      default:
        throw new Error(`Invalid metric type: ${definition.type}`);
    }
  }
  return metrics;
}

export function incrementMetric(metric, value = 1) {
  metric.inc(value);
}

export function observeMetric(metric, value) {
  metric.observe(value);
}

export function getMetrics() {
  return Object.values(metrics);
}
