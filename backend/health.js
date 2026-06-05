import { existsSync, statSync } from "node:fs";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as pipeline from "./agents/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const EVIDENCE_FILE = join(DATA_DIR, "evidence_pack.local.json");
const PIPELINE_STATE = join(ROOT, "data", "pipeline_state.json");

async function checkDataFiles() {
  const checks = [];
  const files = [
    { name: "market_signals_2025_2026.json", required: true },
    { name: "public_market_data.json", required: true },
    { name: "city_language_seed.json", required: true },
    { name: "rag_evidence_layer.json", required: true },
    { name: "blinkit_signals_May2025_May2026.json", required: false }
  ];
  for (const f of files) {
    const path = join(DATA_DIR, f.name);
    let ok = false;
    let size = 0;
    let age = 0;
    try {
      const s = statSync(path);
      ok = true;
      size = s.size;
      age = Date.now() - s.mtime.getTime();
    } catch {}
    checks.push({
      name: f.name,
      path,
      status: ok ? (f.required ? "ok" : "info") : (f.required ? "fail" : "warn"),
      sizeBytes: size,
      ageMs: age,
      required: f.required
    });
  }
  return checks;
}

async function checkEvidenceStore() {
  try {
    const s = statSync(EVIDENCE_FILE);
    const ageMs = Date.now() - s.mtime.getTime();
    let total = 0;
    try {
      const data = JSON.parse(await readFile(EVIDENCE_FILE, "utf8"));
      total = (data.evidence || []).length;
    } catch {}
    return {
      name: "evidence_store",
      status: total > 0 ? "ok" : "warn",
      path: EVIDENCE_FILE,
      sizeBytes: s.size,
      ageMs,
      recordCount: total,
      freshness: ageMs < 3600000 ? "fresh" : ageMs < 86400000 ? "stale" : "very_stale"
    };
  } catch {
    return { name: "evidence_store", status: "warn", path: EVIDENCE_FILE, recordCount: 0, note: "No evidence ingested yet" };
  }
}

async function checkWritable() {
  const testFile = join(DATA_DIR, ".write_test");
  try {
    await writeFile(testFile, "ok");
    await access(testFile);
    return { name: "disk_writable", status: "ok", path: DATA_DIR };
  } catch (e) {
    return { name: "disk_writable", status: "fail", path: DATA_DIR, error: e.message };
  }
}

function checkPipeline() {
  const status = pipeline.getStatus();
  const errors = Object.entries(status.agents || {})
    .filter(([_, a]) => a.status === "error" || a.lastError)
    .map(([name, a]) => ({ agent: name, error: a.lastError }));
  return {
    name: "pipeline",
    status: errors.length > 0 ? "warn" : "ok",
    isRunning: status.isRunning,
    agents: status.agents,
    totalRuns: status.totalRuns,
    lastIngestion: status.lastIngestionResult,
    lastScore: status.lastScoreResult,
    lastBrief: status.lastBriefResult,
    errors
  };
}

export async function getHealth() {
  const start = Date.now();
  const [files, evidence, disk, pipelineStatus] = await Promise.all([
    checkDataFiles(),
    checkEvidenceStore(),
    checkWritable(),
    Promise.resolve(checkPipeline())
  ]);
  const requiredFails = files.filter(f => f.required && f.status === "fail").length;
  const evidenceOk = evidence.status === "ok";
  const diskOk = disk.status === "ok";
  const pipelineOk = pipelineStatus.status !== "fail";

  const allOk = requiredFails === 0 && evidenceOk && diskOk && pipelineOk;
  const overallStatus = allOk ? "healthy" : requiredFails > 0 ? "unhealthy" : "degraded";

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    responseTimeMs: Date.now() - start,
    checks: { files, evidence_store: evidence, disk, pipeline: pipelineStatus },
    summary: {
      filesOk: requiredFails === 0,
      evidenceOk,
      diskOk,
      pipelineOk,
      missingRequired: requiredFails
    }
  };
}

export async function getReadiness() {
  const health = await getHealth();
  const ready = health.summary.filesOk && health.summary.diskOk;
  return {
    ready,
    status: ready ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    blocking: [
      ...(health.summary.filesOk ? [] : ["missing_required_data_files"]),
      ...(health.summary.diskOk ? [] : ["disk_not_writable"])
    ]
  };
}
