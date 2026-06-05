const requestTimings = new Map();
const MAX_SAMPLES = 200;
const WINDOW_MS = 5 * 60 * 1000;

let startedAt = Date.now();
let totalRequests = 0;
let totalErrors = 0;
let pipelineRuns = 0;
let lastReset = Date.now();

const SLOW_ENDPOINT_PREFIXES = [
  "/api/campaign/run",
  "/api/brief/generate",
  "/api/agent/",
  "/api/rag/brief",
  "/api/rag/ingest",
  "/api/assistant",
  "/api/research/refresh",
  "/pipeline/run"
];

function isSlowEndpoint(path) {
  for (const prefix of SLOW_ENDPOINT_PREFIXES) {
    if (path === prefix || path.startsWith(prefix)) return true;
  }
  return false;
}

function recordRequest(method, path, status, durationMs) {
  const key = `${method} ${path}`;
  if (!requestTimings.has(key)) {
    requestTimings.set(key, { method, path, samples: [], count: 0, errors: 0, totalMs: 0, lastCalled: 0, lastStatus: 0, lastDuration: 0 });
  }
  const entry = requestTimings.get(key);
  entry.samples.push(durationMs);
  if (entry.samples.length > MAX_SAMPLES) entry.samples.shift();
  entry.count++;
  entry.totalMs += durationMs;
  entry.lastCalled = Date.now();
  entry.lastStatus = status;
  entry.lastDuration = durationMs;
  if (status >= 500) entry.errors++;
  totalRequests++;
  if (status >= 500) totalErrors++;
}

function percentile(samples, p) {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function recordPipelineRun() {
  pipelineRuns++;
}

function getMetrics() {
  const endpoints = [];
  for (const [key, entry] of requestTimings) {
    const p50 = percentile(entry.samples, 50);
    const p95 = percentile(entry.samples, 95);
    const p99 = percentile(entry.samples, 99);
    endpoints.push({
      key,
      method: entry.method,
      path: entry.path,
      count: entry.count,
      errors: entry.errors,
      errorRate: entry.count ? (entry.errors / entry.count * 100).toFixed(1) : "0.0",
      avgMs: entry.count ? Math.round(entry.totalMs / entry.count) : 0,
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      bucket: isSlowEndpoint(entry.path) ? "slow" : "fast",
      lastCalled: entry.lastCalled ? new Date(entry.lastCalled).toISOString() : null,
      lastStatus: entry.lastStatus,
      lastDurationMs: entry.lastDuration
    });
  }
  endpoints.sort((a, b) => b.count - a.count);

  const fastSamples = [];
  const slowSamples = [];
  for (const e of requestTimings.values()) {
    if (isSlowEndpoint(e.path)) {
      for (const s of e.samples) slowSamples.push(s);
    } else {
      for (const s of e.samples) fastSamples.push(s);
    }
  }
  const allSamples = [...fastSamples, ...slowSamples];

  return {
    service: "bharat-rag-backend",
    uptime: Date.now() - startedAt,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    total: {
      requests: totalRequests,
      errors: totalErrors,
      errorRate: totalRequests ? (totalErrors / totalRequests * 100).toFixed(2) : "0.00",
      pipelineRuns
    },
    latency: {
      p50Ms: percentile(allSamples, 50),
      p95Ms: percentile(allSamples, 95),
      p99Ms: percentile(allSamples, 99),
      avgMs: allSamples.length ? Math.round(allSamples.reduce((a, b) => a + b, 0) / allSamples.length) : 0,
      fast: {
        sampleCount: fastSamples.length,
        p50Ms: percentile(fastSamples, 50),
        p95Ms: percentile(fastSamples, 95),
        p99Ms: percentile(fastSamples, 99),
        avgMs: fastSamples.length ? Math.round(fastSamples.reduce((a, b) => a + b, 0) / fastSamples.length) : 0
      },
      slow: {
        sampleCount: slowSamples.length,
        p50Ms: percentile(slowSamples, 50),
        p95Ms: percentile(slowSamples, 95),
        p99Ms: percentile(slowSamples, 99),
        avgMs: slowSamples.length ? Math.round(slowSamples.reduce((a, b) => a + b, 0) / slowSamples.length) : 0
      }
    },
    endpoints
  };
}

function resetMetrics() {
  requestTimings.clear();
  totalRequests = 0;
  totalErrors = 0;
  pipelineRuns = 0;
  lastReset = Date.now();
}

function getPrometheusMetrics() {
  const m = getMetrics();
  let out = "";
  out += `# HELP bharat_uptime_seconds Backend uptime in seconds\n`;
  out += `# TYPE bharat_uptime_seconds gauge\n`;
  out += `bharat_uptime_seconds ${m.uptimeSec}\n\n`;
  out += `# HELP bharat_requests_total Total HTTP requests\n`;
  out += `# TYPE bharat_requests_total counter\n`;
  out += `bharat_requests_total ${m.total.requests}\n\n`;
  out += `# HELP bharat_errors_total Total HTTP 5xx errors\n`;
  out += `# TYPE bharat_errors_total counter\n`;
  out += `bharat_errors_total ${m.total.errors}\n\n`;
  out += `# HELP bharat_pipeline_runs_total Total pipeline runs\n`;
  out += `# TYPE bharat_pipeline_runs_total counter\n`;
  out += `bharat_pipeline_runs_total ${m.total.pipelineRuns}\n\n`;
  out += `# HELP bharat_endpoint_request_duration_ms Request duration by endpoint\n`;
  out += `# TYPE bharat_endpoint_request_duration_ms summary\n`;
  for (const e of m.endpoints) {
    const label = `method="${e.method}",path="${e.path}"`;
    out += `bharat_endpoint_request_duration_ms{${label},quantile="0.5"} ${e.p50Ms}\n`;
    out += `bharat_endpoint_request_duration_ms{${label},quantile="0.95"} ${e.p95Ms}\n`;
    out += `bharat_endpoint_request_duration_ms{${label},quantile="0.99"} ${e.p99Ms}\n`;
    out += `bharat_endpoint_requests_total{${label}} ${e.count}\n`;
    out += `bharat_endpoint_errors_total{${label}} ${e.errors}\n`;
  }
  return out;
}

function timingMiddleware(handler) {
  return async (req, res) => {
    const start = Date.now();
    let status = 200;
    try {
      await handler(req, res);
    } catch (e) {
      status = 500;
      throw e;
    } finally {
      const duration = Date.now() - start;
      const url = new URL(req.url, `http://${req.headers.host}`);
      const path = normalizePath(url.pathname);
      recordRequest(req.method, path, status, duration);
    }
  };
}

function normalizePath(pathname) {
  if (pathname.startsWith("/api/rag/")) return "/api/rag/*";
  if (pathname.length > 50) return pathname.slice(0, 50) + "...";
  return pathname;
}

export { recordRequest, recordPipelineRun, getMetrics, getPrometheusMetrics, resetMetrics, timingMiddleware, isSlowEndpoint, SLOW_ENDPOINT_PREFIXES };
