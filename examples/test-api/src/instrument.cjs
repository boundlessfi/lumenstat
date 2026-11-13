// OpenTelemetry setup, loaded with `node --require` before the app.
//
// This is all a tenant adds to send API metrics to SCF Analytics: a second span
// exporter pointed at the SCF collector, with their ingest key. Their existing
// exporter (the console here, standing in for Datadog, Honeycomb, Grafana...) is
// untouched, so their own APM keeps the full traces.
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { BatchSpanProcessor, ConsoleSpanExporter } = require('@opentelemetry/sdk-trace');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

// This example sends traces only; the SCF collector turns server spans into
// metrics. Without these defaults the SDK would also push its own metrics and
// logs to localhost:4318 every 60 s, with no ingest key, and the writer would
// drop them.
process.env.OTEL_METRICS_EXPORTER ??= 'none';
process.env.OTEL_LOGS_EXPORTER ??= 'none';

const endpoint = process.env.SCF_OTLP_ENDPOINT || 'http://localhost:4318';
const ingestKey = process.env.SCF_INGEST_KEY || '';

if (!ingestKey) {
  console.warn('[otel] SCF_INGEST_KEY is empty; the SCF collector will accept the data but the writer will drop it.');
}

const spanProcessors = [
  // Export 2: SCF Analytics. Only counts and timings survive on the SCF side.
  new BatchSpanProcessor({
    exporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers: { 'x-scf-ingest-key': ingestKey },
    }),
    scheduledDelayMillis: 1000,
  }),
];

// Export 1: the team's own APM. The console keeps the example self-contained.
if (process.env.OWN_APM_CONSOLE === '1') {
  spanProcessors.push(new BatchSpanProcessor({ exporter: new ConsoleSpanExporter() }));
}

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'scf-test-api',
  spanProcessors,
  instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
