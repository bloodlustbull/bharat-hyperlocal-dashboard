import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const EVIDENCE_FILE = path.join(DATA_DIR, "evidence_pack.local.json");

export async function loadStoredEvidence() {
  try {
    return JSON.parse(await readFile(EVIDENCE_FILE, "utf8"));
  } catch {
    return { evidence: [], providers: {} };
  }
}

export async function saveEvidence(records) {
  const dir = path.dirname(EVIDENCE_FILE);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const existing = await loadStoredEvidence();
  const merged = [...(existing.evidence || []), ...records];
  const seen = new Set();
  const deduped = [];
  for (const item of merged) {
    const key = item.id || `${item.source_type}-${item.claim?.slice(0, 40)}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(item); }
  }
  const payload = { ...existing, evidence: deduped, updatedAt: new Date().toISOString() };
  await writeFile(EVIDENCE_FILE, JSON.stringify(payload, null, 2), "utf8");
  return { total: deduped.length, inserted: records.length, file: EVIDENCE_FILE };
}

export async function getEvidenceStats() {
  const stored = await loadStoredEvidence();
  const items = stored.evidence || [];
  const sources = {};
  const confidence = { A: 0, B: 0, C: 0, D: 0 };
  const cities = {};
  for (const item of items) {
    sources[item.source_type] = (sources[item.source_type] || 0) + 1;
    if (item.confidence) confidence[item.confidence] = (confidence[item.confidence] || 0) + 1;
    const c = item.city || "unknown";
    cities[c] = (cities[c] || 0) + 1;
  }
  return { total: items.length, sources, confidence, cities, updatedAt: stored.updatedAt };
}
