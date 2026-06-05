import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

describe("Security", () => {
  it(".env.local must not be tracked", () => {
    const tracked = execFileSync("git", ["ls-files"], { encoding: "utf-8", cwd: ROOT });
    assert.ok(!tracked.split("\n").includes("backend/.env.local"), "backend/.env.local must be gitignored");
    assert.ok(!tracked.split("\n").some(f => f.startsWith("backend/.env.") && !f.endsWith(".example")), "no backend/.env.* files committed");
    assert.ok(!tracked.split("\n").some(f => f.startsWith("data/") && f.endsWith(".local.json")), "no data/*.local.json files committed");
  });

  it(".gitignore must cover .env* and runtime files", () => {
    const gi = readFileSync(path.join(ROOT, ".gitignore"), "utf-8");
    for (const required of [".env", ".env.local", ".env.*.local", "backend/.env.local", "node_modules/", "dist/", "logs/", "data/*.local.json"]) {
      assert.ok(gi.includes(required), `.gitignore must include "${required}"`);
    }
  });

  it("SECURITY.md must exist", () => {
    assert.ok(existsSync(path.join(ROOT, "SECURITY.md")), "SECURITY.md must exist");
  });

  it("frontend must not contain any LLM API keys", () => {
    const indexHtml = readFileSync(path.join(ROOT, "index.html"), "utf-8");
    const appJs = readFileSync(path.join(ROOT, "app.js"), "utf-8");
    const styles = readFileSync(path.join(ROOT, "styles.css"), "utf-8");
    for (const [name, content] of [["index.html", indexHtml], ["app.js", appJs], ["styles.css", styles]]) {
      assert.ok(!/gsk_[A-Za-z0-9]{20,}/.test(content), `${name} must not contain a Groq key`);
      assert.ok(!/sk-[A-Za-z0-9]{40,}/.test(content), `${name} must not contain an OpenAI key`);
      assert.ok(!/tvly-[A-Za-z0-9]{20,}/.test(content), `${name} must not contain a Tavily key`);
      assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(content), `${name} must not contain a Google API key`);
    }
  });

  it("backend server.js must not leak keys in /api/llm/status response", () => {
    const server = readFileSync(path.join(ROOT, "backend", "server.js"), "utf-8");
    const idx = server.indexOf("/api/llm/status");
    const slice = server.slice(idx, idx + 1500);
    assert.ok(!slice.includes("process.env.GROQ_API_KEY"), "status route must not return raw GROQ key");
    assert.ok(!slice.includes("process.env.MISTRAL_API_KEY"), "status route must not return raw MISTRAL key");
    assert.ok(!slice.includes("process.env.TAVILY_API_KEY"), "status route must not return raw TAVILY key");
  });

  it("security-scan.mjs script exists and is wired", () => {
    const scanPath = path.join(ROOT, "scripts", "security-scan.mjs");
    assert.ok(existsSync(scanPath), "scripts/security-scan.mjs must exist");
    const scan = readFileSync(scanPath, "utf-8");
    assert.ok(scan.includes("gsk_"), "scanner must look for Groq keys");
    assert.ok(scan.includes("tvly-"), "scanner must look for Tavily keys");
    assert.ok(scan.includes("AKIA"), "scanner must look for AWS keys");
  });

  it("security scan passes on the current tree", () => {
    const result = execFileSync("node", ["scripts/security-scan.mjs"], { encoding: "utf-8", cwd: ROOT });
    assert.ok(result.includes("No real secrets found"), `security scan should pass: ${result}`);
  });
});
