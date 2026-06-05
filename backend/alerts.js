const alerts = [];
let listeners = new Set();
const RULES = {
  errorRate: { threshold: 5, severity: "warning", message: "Error rate above 5% over last 5 min" },
  highLatency: { threshold: 1000, severity: "warning", message: "P95 latency above 1000ms" },
  evidenceStale: { threshold: 24 * 60 * 60 * 1000, severity: "warning", message: "Evidence store has not been updated in 24h" },
  diskFull: { severity: "critical", message: "Disk not writable" },
  pipelineError: { severity: "critical", message: "Pipeline agent errored" },
  backendDown: { severity: "critical", message: "Backend failed health check" },
  noDataFiles: { severity: "critical", message: "Required data files missing" }
};

function emit(ruleKey, detail = {}) {
  const rule = RULES[ruleKey];
  if (!rule) return;
  const alert = {
    id: `${ruleKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    rule: ruleKey,
    severity: rule.severity,
    message: rule.message,
    detail,
    timestamp: new Date().toISOString(),
    acknowledged: false
  };
  alerts.unshift(alert);
  if (alerts.length > 200) alerts.pop();
  console.log(`[ALERT][${rule.severity.toUpperCase()}] ${ruleKey}: ${rule.message}`, detail);
  for (const fn of listeners) {
    try { fn(alert); } catch (e) { console.error("Alert listener failed:", e); }
  }
  return alert;
}

function evaluate(metrics, health) {
  if (!metrics) return;
  const errRate = parseFloat(metrics.total?.errorRate || "0");
  if (errRate > RULES.errorRate.threshold) emit("errorRate", { errorRate: errRate });
  if (metrics.latency?.p95Ms > RULES.highLatency.threshold) emit("highLatency", { p95Ms: metrics.latency.p95Ms });
  if (health) {
    if (health.checks?.evidence_store?.ageMs > RULES.evidenceStale.threshold) {
      emit("evidenceStale", { ageMs: health.checks.evidence_store.ageMs });
    }
    if (health.checks?.disk?.status !== "ok") emit("diskFull", { status: health.checks.disk.status });
    if (health.checks?.pipeline?.errors?.length) {
      for (const e of health.checks.pipeline.errors) emit("pipelineError", e);
    }
    if (health.status === "unhealthy") emit("backendDown", { status: health.status });
    if (health.summary?.missingRequired) emit("noDataFiles", { missing: health.summary.missingRequired });
  }
}

function acknowledge(id) {
  const a = alerts.find(x => x.id === id);
  if (a) a.acknowledged = true;
}

function acknowledgeAll() {
  for (const a of alerts) a.acknowledged = true;
}

function clear() {
  alerts.length = 0;
}

function getAlerts(opts = {}) {
  let list = [...alerts];
  if (!opts.includeAcknowledged) list = list.filter(a => !a.acknowledged);
  if (opts.severity) list = list.filter(a => a.severity === opts.severity);
  return {
    count: list.length,
    critical: list.filter(a => a.severity === "critical").length,
    warning: list.filter(a => a.severity === "warning").length,
    alerts: list.slice(0, opts.limit || 50)
  };
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export { evaluate, emit, acknowledge, acknowledgeAll, clear, getAlerts, subscribe, RULES };
