import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const skipDirs = new Set([".git", "node_modules", "dist", ".vite", "coverage"]);
const knownLocalScripts = new Set(["Run-Dashboard.bat", "scripts/Install-Dashboard-AutoStart.ps1", "scripts/Start-Dashboard.ps1", "scripts/fetch-keys.js"]);
const riskyExtensions = new Set([".exe", ".dll", ".scr", ".msi", ".com", ".jar", ".vbs", ".ps1", ".bat", ".cmd"]);
const textExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".md", ".yml", ".yaml", ".sh", ".ps1", ".bat", ".cmd", ".html", ".css", ".env", ".txt"]);
const suspiciousPatterns = [
  { name: "remote shell download", pattern: /\b(curl|wget|Invoke-WebRequest|iwr)\b[\s\S]{0,120}\|\s*(bash|sh|iex|Invoke-Expression)/i },
  { name: "destructive recursive delete", pattern: /\b(rm\s+-rf|Remove-Item\b[\s\S]{0,80}-Recurse|del\s+\/[sq])/i },
  { name: "credential exfiltration hint", pattern: /(process\.env|\.env|api[_-]?key|token|secret)[\s\S]{0,160}(webhook|discord|telegram|pastebin|requestbin|ngrok)/i },
  { name: "base64 eval", pattern: /(eval|Function|Invoke-Expression)[\s\S]{0,80}(atob|base64|FromBase64String)/i },
  { name: "postinstall hook", pattern: /"postinstall"\s*:/i },
  { name: "preinstall hook", pattern: /"preinstall"\s*:/i },
  { name: "public llm key pattern", pattern: /\bsk-[A-Za-z0-9]{30,}\b/ }
];

const findings = [];

async function scanFile(file) {
  const ext = path.extname(file);
  const rel = path.relative(root, file) || file;
  const normalizedRel = rel.replaceAll("\\", "/");
  if (normalizedRel === "scripts/security-scan.mjs" || knownLocalScripts.has(normalizedRel)) return;
  if (riskyExtensions.has(ext)) {
    findings.push({ severity: "high", file: rel, issue: `risky executable/script extension (${ext})` });
  }
  if (!textExtensions.has(ext) && !["", ".gitignore"].includes(ext)) return;
  let text = "";
  try {
    text = await readFile(file, "utf8");
  } catch {
    return;
  }
  suspiciousPatterns.forEach(({ name, pattern }) => {
    if (pattern.test(text)) findings.push({ severity: name.includes("key") ? "medium" : "high", file: rel, issue: name });
  });
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
    } else if (entry.isFile()) {
      const info = await stat(full);
      if (info.size <= 2_000_000) await scanFile(full);
    }
  }
}

await walk(root);

if (!findings.length) {
  console.log(`No obvious high-risk patterns found in ${root}`);
  process.exit(0);
}

console.log(`Security scan findings for ${root}:`);
findings.forEach(item => {
  console.log(`- [${item.severity}] ${item.file}: ${item.issue}`);
});
process.exit(findings.some(item => item.severity === "high") ? 2 : 1);
