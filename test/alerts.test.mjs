import test from "node:test";
import assert from "node:assert/strict";
import {
  isSlowEndpoint,
  SLOW_ENDPOINT_PREFIXES,
  recordRequest,
  resetMetrics,
  getMetrics
} from "../backend/observability.js";
import { evaluate, getAlerts, clear, RULES } from "../backend/alerts.js";

test("alerts + observability: latency budgets are split between fast and slow endpoints", async (t) => {
  await t.test("isSlowEndpoint classifies LLM/chain routes as slow", () => {
    assert.equal(isSlowEndpoint("/api/campaign/run"), true);
    assert.equal(isSlowEndpoint("/api/brief/generate"), true);
    assert.equal(isSlowEndpoint("/api/agent/research"), true);
    assert.equal(isSlowEndpoint("/api/agent/audience"), true);
    assert.equal(isSlowEndpoint("/api/agent/copy"), true);
    assert.equal(isSlowEndpoint("/api/agent/channel"), true);
    assert.equal(isSlowEndpoint("/api/agent/compliance"), true);
    assert.equal(isSlowEndpoint("/api/rag/brief"), true);
    assert.equal(isSlowEndpoint("/api/rag/ingest"), true);
    assert.equal(isSlowEndpoint("/api/assistant"), true);
    assert.equal(isSlowEndpoint("/api/research/refresh"), true);
    assert.equal(isSlowEndpoint("/pipeline/run"), true);
  });

  await t.test("isSlowEndpoint classifies read/control routes as fast", () => {
    assert.equal(isSlowEndpoint("/healthz"), false);
    assert.equal(isSlowEndpoint("/readyz"), false);
    assert.equal(isSlowEndpoint("/metrics"), false);
    assert.equal(isSlowEndpoint("/alerts"), false);
    assert.equal(isSlowEndpoint("/api/signals"), false);
    assert.equal(isSlowEndpoint("/api/live"), false);
    assert.equal(isSlowEndpoint("/api/campaign/active"), false);
    assert.equal(isSlowEndpoint("/api/campaign/history"), false);
    assert.equal(isSlowEndpoint("/api/campaign/events/stream"), false);
    assert.equal(isSlowEndpoint("/api/llm/status"), false);
    assert.equal(isSlowEndpoint("/api/agent/research"), true);
  });

  await t.test("SLOW_ENDPOINT_PREFIXES is exported and non-empty", () => {
    assert.ok(Array.isArray(SLOW_ENDPOINT_PREFIXES));
    assert.ok(SLOW_ENDPOINT_PREFIXES.length > 0);
    for (const p of SLOW_ENDPOINT_PREFIXES) assert.equal(typeof p, "string");
  });

  await t.test("a single slow endpoint does not contaminate fast p95", () => {
    resetMetrics();
    recordRequest("GET", "/api/signals", 200, 5);
    recordRequest("GET", "/api/signals", 200, 7);
    recordRequest("GET", "/api/live", 200, 4);
    recordRequest("GET", "/api/live", 200, 6);
    recordRequest("POST", "/api/campaign/run", 200, 9000);
    const m = getMetrics();
    assert.equal(m.latency.fast.sampleCount, 4);
    assert.equal(m.latency.slow.sampleCount, 1);
    assert.ok(m.latency.fast.p95Ms <= 7, `fast p95 should stay low, got ${m.latency.fast.p95Ms}`);
    assert.equal(m.latency.slow.p95Ms, 9000);
    assert.ok(m.latency.fast.p95Ms < RULES.highLatency.threshold, "fast budget should not trigger the highLatency alert");
  });

  await t.test("per-endpoint bucket label is correct", () => {
    resetMetrics();
    recordRequest("GET", "/api/signals", 200, 5);
    recordRequest("POST", "/api/campaign/run", 200, 5000);
    const m = getMetrics();
    const signals = m.endpoints.find(e => e.path === "/api/signals");
    const campaign = m.endpoints.find(e => e.path === "/api/campaign/run");
    assert.equal(signals.bucket, "fast");
    assert.equal(campaign.bucket, "slow");
  });

  await t.test("highLatency alert fires only on fast p95 breach", () => {
    clear();
    resetMetrics();
    for (let i = 0; i < 10; i++) recordRequest("GET", "/api/signals", 200, 2000);
    recordRequest("POST", "/api/campaign/run", 200, 9000);
    evaluate(getMetrics(), null);
    const a = getAlerts();
    const highLatency = a.alerts.find(x => x.rule === "highLatency");
    assert.ok(highLatency, "highLatency should fire when fast p95 > 1000ms");
    assert.equal(highLatency.detail.scope, "fast");
    const highLatencyLLM = a.alerts.find(x => x.rule === "highLatencyLLM");
    assert.equal(highLatencyLLM, undefined, "highLatencyLLM should not fire when slow p95 is below 30s");
  });

  await t.test("highLatencyLLM alert fires only on slow p95 breach", () => {
    clear();
    resetMetrics();
    for (let i = 0; i < 5; i++) recordRequest("GET", "/api/signals", 200, 5);
    for (let i = 0; i < 3; i++) recordRequest("POST", "/api/campaign/run", 200, 35000);
    evaluate(getMetrics(), null);
    const a = getAlerts();
    const highLatencyLLM = a.alerts.find(x => x.rule === "highLatencyLLM");
    assert.ok(highLatencyLLM, "highLatencyLLM should fire when slow p95 > 30s");
    assert.equal(highLatencyLLM.detail.scope, "slow");
    const highLatency = a.alerts.find(x => x.rule === "highLatency");
    assert.equal(highLatency, undefined, "fast highLatency should not fire on healthy fast endpoints");
  });

  await t.test("no false alarm on a single chain run with healthy fast budget", () => {
    clear();
    resetMetrics();
    for (let i = 0; i < 20; i++) recordRequest("GET", "/api/signals", 200, 5);
    recordRequest("POST", "/api/campaign/run", 200, 9000);
    evaluate(getMetrics(), null);
    const a = getAlerts();
    const highLatency = a.alerts.find(x => x.rule === "highLatency");
    assert.equal(highLatency, undefined, "the original 9s campaign run alone must not trigger the highLatency alert anymore");
  });

  await t.test("highLatencyLLM does not fire when there are no slow samples", () => {
    clear();
    resetMetrics();
    for (let i = 0; i < 5; i++) recordRequest("GET", "/api/signals", 200, 5);
    evaluate(getMetrics(), null);
    const a = getAlerts();
    const highLatencyLLM = a.alerts.find(x => x.rule === "highLatencyLLM");
    assert.equal(highLatencyLLM, undefined, "should not fire with zero slow samples");
  });
});
