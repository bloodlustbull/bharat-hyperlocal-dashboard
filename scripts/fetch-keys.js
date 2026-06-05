import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_URL = "https://raw.githubusercontent.com/alistaitsacle/free-llm-api-keys/main/README.md";
const targetUrl = process.argv[2] || DEFAULT_URL;
const outDir = path.resolve("security-reports");
const outFile = path.join(outDir, "free-llm-api-keys-audit.json");

const suspiciousPatterns = [
  { name: "shell command", severity: "high", pattern: /\b(curl|wget|Invoke-WebRequest|iwr|bash|sh|powershell|cmd\.exe|rm\s+-rf|Remove-Item)\b/i },
  { name: "embedded script tag", severity: "high", pattern: /<script[\s\S]*?>/i },
  { name: "install hook", severity: "high", pattern: /"(preinstall|install|postinstall)"\s*:/i },
  { name: "base64 eval", severity: "high", pattern: /(eval|Function|Invoke-Expression)[\s\S]{0,120}(base64|atob|FromBase64String)/i },
  { name: "known api key shape", severity: "medium", pattern: /\b(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[0-9A-Za-z-]{20,})\b/g },
  { name: "unknown proxy/base url", severity: "medium", pattern: /(base[_-]?url|api[_-]?url|endpoint)[^\n]{0,120}(http:\/\/|https:\/\/)/ig }
];

function scan(text) {
  return suspiciousPatterns.flatMap(rule => {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const pattern = new RegExp(rule.pattern.source, flags);
    const matches = [...text.matchAll(pattern)];
    return matches.slice(0, 20).map(match => ({
      severity: rule.severity,
      issue: rule.name,
      preview: redactSensitive(String(match[0]).slice(0, 180))
    }));
  });
}

function redactSensitive(value) {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, match => `${match.slice(0, 6)}...redacted`)
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, match => `${match.slice(0, 6)}...redacted`)
    .replace(/\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g, match => `${match.slice(0, 6)}...redacted`);
}

function extractCandidateStats(text) {
  const openAiLike = [...text.matchAll(/\bsk-[A-Za-z0-9_-]{20,}\b/g)].length;
  const urls = [...text.matchAll(/https?:\/\/[^\s)`"']+/g)].map(match => match[0]);
  return {
    openAiLikeKeyCount: openAiLike,
    urlCount: urls.length,
    urls: urls.slice(0, 25)
  };
}

const response = await fetch(targetUrl, {
  headers: { "User-Agent": "BharatHyperlocalSecurityAudit/1.0" }
});

if (!response.ok) {
  throw new Error(`Could not fetch ${targetUrl}: ${response.status}`);
}

const text = await response.text();
const findings = scan(text);
const report = {
  scannedAt: new Date().toISOString(),
  source: targetUrl,
  byteLength: Buffer.byteLength(text),
  decision: "refused_key_import",
  reason: "Public third-party API keys are treated as leaked or unauthorized credentials. This script audits the file but does not extract, save, rotate, or use those keys.",
  candidateStats: extractCandidateStats(text),
  findings
};

await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify(report, null, 2));

console.log(`Audit saved to ${outFile}`);
console.log(`Decision: ${report.decision}`);
console.log(`Findings: ${findings.length}`);

if (findings.some(item => item.severity === "high")) {
  process.exitCode = 2;
} else if (findings.length) {
  process.exitCode = 1;
}
