import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getMetrics } from "./observability.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const HISTORY_FILE = join(__dirname, "..", "data", "metrics_history.json");
const MAX_POINTS = 1440;
const FLUSH_INTERVAL_MS = 60_000;

let history = {
  points: [],
  endpointSnapshots: {},
  lastFlushed: 0
};
let flushTimer = null;

async function loadFromDisk() {
  try {
    const raw = await readFile(HISTORY_FILE, "utf8");
    const data = JSON.parse(raw);
    history.points = data.points || [];
    history.endpointSnapshots = data.endpointSnapshots || {};
    history.lastFlushed = data.lastFlushed || 0;
    console.log(`[metrics-history] Loaded ${history.points.length} historical points`);
  } catch (e) {
    if (e.code !== "ENOENT") console.warn("[metrics-history] Load failed:", e.message);
  }
}

async function flush() {
  try {
    const m = getMetrics();
    const point = {
      t: Date.now(),
      timestamp: new Date().toISOString(),
      requests: m.total.requests,
      errors: m.total.errors,
      errorRate: parseFloat(m.total.errorRate || "0"),
      p50Ms: m.latency.p50Ms,
      p95Ms: m.latency.p95Ms,
      p99Ms: m.latency.p99Ms,
      pipelineRuns: m.total.pipelineRuns,
      uptime: m.uptimeSec
    };
    history.points.push(point);
    if (history.points.length > MAX_POINTS) history.points.shift();
    for (const e of m.endpoints) {
      if (!history.endpointSnapshots[e.key]) history.endpointSnapshots[e.key] = [];
      history.endpointSnapshots[e.key].push({ t: point.t, count: e.count, p95: e.p95Ms, errors: e.errors });
      if (history.endpointSnapshots[e.key].length > MAX_POINTS) history.endpointSnapshots[e.key].shift();
    }
    history.lastFlushed = Date.now();
    await mkdir(join(__dirname, "..", "data"), { recursive: true });
    await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
  } catch (e) {
    console.warn("[metrics-history] Flush failed:", e.message);
  }
}

function startAutoFlush() {
  if (flushTimer) return;
  flush();
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
  console.log(`[metrics-history] Auto-flush started (every ${FLUSH_INTERVAL_MS/1000}s, max ${MAX_POINTS} points)`);
}

function stopAutoFlush() {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
}

function getHistory(opts = {}) {
  const windowMs = opts.windowMs || 3600_000;
  const since = Date.now() - windowMs;
  const points = history.points.filter(p => p.t >= since);
  return {
    count: points.length,
    windowMs,
    since,
    until: Date.now(),
    points,
    endpoints: Object.fromEntries(
      Object.entries(history.endpointSnapshots).map(([k, arr]) => [k, arr.filter(p => p.t >= since)])
    )
  };
}

function getSummary(windowMs = 3600_000) {
  const points = history.points.filter(p => p.t >= Date.now() - windowMs);
  if (!points.length) return { count: 0 };
  const totalReqs = points.length ? points[points.length - 1].requests - (points[0]?.requests || 0) : 0;
  const totalErrs = points.length ? points[points.length - 1].errors - (points[0]?.errors || 0) : 0;
  const peakP95 = Math.max(...points.map(p => p.p95Ms));
  const avgP95 = points.reduce((s, p) => s + p.p95Ms, 0) / points.length;
  return {
    count: points.length,
    windowMs,
    totalRequests: totalReqs,
    totalErrors: totalErrs,
    errorRate: totalReqs > 0 ? (totalErrs / totalReqs * 100).toFixed(2) : "0.00",
    peakP95Ms: peakP95,
    avgP95Ms: Math.round(avgP95)
  };
}

await loadFromDisk();

export { startAutoFlush, stopAutoFlush, flush, getHistory, getSummary };
