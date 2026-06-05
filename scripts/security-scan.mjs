import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  { name: "groq key (gsk_*)", re: /gsk_[A-Za-z0-9]{20,}/g },
  { name: "openai sk key (sk-<48+ base64-ish>)", re: /\bsk-[A-Za-z0-9]{40,}\b/g },
  { name: "openai project key (sk-proj-*)", re: /sk-proj-[A-Za-z0-9_-]{40,}/g },
  { name: "anthropic key (sk-ant-*)", re: /sk-ant-[A-Za-z0-9_-]{40,}/g },
  { name: "tavily key (tvly-*)", re: /tvly-[A-Za-z0-9]{20,}/g },
  { name: "google api key (AIza*)", re: /AIza[0-9A-Za-z_-]{20,}/g },
  { name: "slack token (xox*)", re: /xox[baprs]-[0-9A-Za-z-]{20,}/g },
  { name: "aws access key (AKIA*)", re: /AKIA[0-9A-Z]{16}/g },
  { name: "github token (gh*_*)", re: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { name: "private key header", re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { name: "jwt token (eyJ*.eyJ*)", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g }
];

const ALLOWED_FILES = new Set([
  "README.md",
  "backend/.env.example",
  "docs/CAMPAIGN_FACTORY.md",
  "docs/RAG_EVIDENCE_BACKEND.md",
  "docs/SOURCES.md",
  "test/backend.test.mjs",
  "scripts/fetch-keys.js",
  "scripts/security-scan.mjs",
  "backend/secure-config.js",
  "security-reports/free-llm-api-keys-audit.json"
]);

const files = execSync("git ls-files", { encoding: "utf-8" }).trim().split("\n");
const findings = [];
for (const f of files) {
  let content;
  try { content = readFileSync(f, "utf-8"); } catch { continue; }
  for (const p of PATTERNS) {
    const matches = content.match(p.re);
    if (!matches) continue;
    for (const m of matches) {
      findings.push({ file: f, pattern: p.name, sample: m.slice(0, 12) + (m.length > 12 ? "..." : ""), inAllowList: ALLOWED_FILES.has(f) });
    }
  }
}

const real = findings.filter(f => !f.inAllowList);
const allowlisted = findings.filter(f => f.inAllowList);

if (real.length === 0) {
  console.log("✓ No real secrets found in tracked files.");
  if (allowlisted.length) {
    console.log(`  (${allowlisted.length} allowlisted hits — placeholders, security audit reports, regex patterns.)`);
  }
  process.exit(0);
} else {
  console.error("✗ Potential secrets found in tracked files:");
  for (const fnd of real) {
    console.error(`  ${fnd.file} :: ${fnd.pattern} :: ${fnd.sample}`);
  }
  process.exit(1);
}
