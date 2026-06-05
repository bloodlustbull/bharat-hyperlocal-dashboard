import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");

async function loadJson(file) {
  return JSON.parse(await readFile(path.join(DATA, file), "utf8"));
}

describe("RAG Evidence Layer", () => {
  let ragConfig;

  it("should load and have valid structure", async () => {
    ragConfig = await loadJson("rag_evidence_layer.json");
    assert.ok(ragConfig.version, "should have version");
    assert.ok(Array.isArray(ragConfig.connectors), "should have connectors array");
    assert.ok(Array.isArray(ragConfig.jobs), "should have jobs array");
    assert.ok(ragConfig.evidenceSchema, "should have evidenceSchema");
    assert.ok(ragConfig.backendContract, "should have backendContract");
  });

  it("should have connectors with valid statuses", async () => {
    ragConfig = ragConfig || await loadJson("rag_evidence_layer.json");
    const validStatuses = ["active", "backend_required", "manual_upload", "loaded_partial", "api_key_required"];
    for (const c of ragConfig.connectors) {
      assert.ok(c.id, `connector missing id: ${c.name}`);
      assert.ok(validStatuses.includes(c.status), `invalid status "${c.status}" for ${c.id}`);
      assert.ok(c.confidenceDefault, `missing confidenceDefault for ${c.id}`);
    }
  });

  it("should have jobs with valid connector refs", async () => {
    ragConfig = ragConfig || await loadJson("rag_evidence_layer.json");
    const connectorIds = new Set(ragConfig.connectors.map((c) => c.id));
    for (const job of ragConfig.jobs) {
      assert.ok(job.id, `job missing id`);
      assert.ok(Array.isArray(job.connectors), `job ${job.id} missing connectors`);
      for (const ref of job.connectors) {
        assert.ok(connectorIds.has(ref), `job ${job.id} references unknown connector: ${ref}`);
      }
    }
  });

  it("should have evidenceSchema with required fields and confidence rules", async () => {
    ragConfig = ragConfig || await loadJson("rag_evidence_layer.json");
    assert.ok(ragConfig.evidenceSchema.requiredFields.includes("id"), "id field required");
    assert.ok(ragConfig.evidenceSchema.requiredFields.includes("city"), "city field required");
    assert.ok(ragConfig.evidenceSchema.requiredFields.includes("claim"), "claim field required");
    assert.ok(ragConfig.evidenceSchema.confidenceRules.A, "confidence A defined");
    assert.ok(ragConfig.evidenceSchema.confidenceRules.D, "confidence D defined");
  });

  it("should have backend contract definition", async () => {
    ragConfig = ragConfig || await loadJson("rag_evidence_layer.json");
    assert.ok(ragConfig.backendContract.briefEndpoint, "brief endpoint defined");
    assert.ok(ragConfig.backendContract.ingestEndpoint, "ingest endpoint defined");
    assert.ok(ragConfig.backendContract.localStorageKey === "bharatRagApiUrl", "localStorage key correct");
  });
});

describe("Market Data Integrity", () => {
  it("should have source confidence distribution", async () => {
    const marketData = await loadJson("public_market_data.json");
    const sources = marketData.sources || [];
    assert.ok(sources.length > 0, "should have sources");
    const confidences = {};
    sources.forEach((s) => {
      confidences[s.type] = (confidences[s.type] || 0) + 1;
    });
    assert.ok(confidences.A || confidences.B, "should have A or B confidence sources");
  });
});

describe("Market Signals Schema", () => {
  it("should have properly structured signals", async () => {
    let signals;
    try {
      signals = await loadJson("market_signals_2025_2026.json");
    } catch {
      return; // file is optional
    }
    if (!signals || !signals.signals) return;
    for (const s of signals.signals.slice(0, 10)) {
      assert.ok(s.id, `signal missing id`);
      assert.ok(s.confidence, `signal ${s.id} missing confidence`);
      assert.ok(s.source_url, `signal ${s.id} missing source_url`);
    }
  });
});
