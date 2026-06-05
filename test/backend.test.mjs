import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, existsSync } from "node:fs";
import { readFile as readFilePromise } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

describe("Data Files", () => {
  const requiredFiles = [
    "data/rag_evidence_layer.json",
    "data/public_market_data.json",
    "data/city_language_seed.json",
    "data/market_signals_2025_2026.json",
    "data/blinkit_signals_May2025_May2026.json",
  ];

  for (const file of requiredFiles) {
    it(`${file} should exist`, () => {
      assert.ok(existsSync(path.join(ROOT, file)), `Missing: ${file}`);
    });
  }

  it("rag_evidence_layer.json should have valid structure", async () => {
    const content = JSON.parse(
      await readFilePromise(path.join(ROOT, "data", "rag_evidence_layer.json"), "utf8")
    );
    assert.ok(content.version, "should have version");
    assert.ok(Array.isArray(content.connectors), "should have connectors array");
    assert.ok(Array.isArray(content.jobs), "should have jobs array");
    assert.ok(content.evidenceSchema, "should have evidenceSchema");
    assert.ok(content.backendContract, "should have backendContract");
  });
});

describe("Frontend App", () => {
  it("app.js should define window globals", async () => {
    const src = await readFilePromise(path.join(ROOT, "app.js"), "utf8");
    assert.ok(src.includes("window.enterDashboard = enterDashboard"), "enterDashboard");
    assert.ok(src.includes("window.showBrandMap = showBrandMap"), "showBrandMap");
    assert.ok(src.includes("window.showLanding = showLanding"), "showLanding");
    assert.ok(src.includes("window.goToDashboardTab = showTab"), "goToDashboardTab");
  });

  it("app.js should load from public/data via fetch", async () => {
    const src = await readFilePromise(path.join(ROOT, "app.js"), "utf8");
    const dataFetches = src.match(/loadJson\("data\/[^"]+"/g);
    assert.ok(dataFetches && dataFetches.length >= 3, "should fetch at least 3 data files");
  });
});

describe("Security: No Exposed Credentials", () => {
  const apiKeyPattern = /\b(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[0-9A-Za-z-]{20,})\b/g;
  const placeholderPattern = /\byour_key_here\b/i;

  const sourceFiles = ["app.js", "index.html", "src/main.js", "voice-assistant.js"];

  for (const file of sourceFiles) {
    it(`${file} should not contain API key patterns`, async () => {
      const fullPath = path.join(ROOT, file);
      if (!existsSync(fullPath)) return;
      const src = await readFilePromise(fullPath, "utf8");
      const matches = src.match(apiKeyPattern);
      assert.equal(matches, null, `${file} contains potential API keys: ${matches?.join(", ") || "none"}`);
    });
  }

  it("backend .env.local should not contain placeholder keys", async () => {
    const envPath = path.join(ROOT, "backend", ".env.local");
    if (!existsSync(envPath)) return;
    const src = await readFilePromise(envPath, "utf8");
    const matches = src.match(placeholderPattern);
    assert.equal(matches, null, ".env.local contains placeholder keys: " + (matches?.join(", ") || "none"));
  });
});

describe("Package Scripts", () => {
  it("should have all required npm scripts", async () => {
    const pkg = JSON.parse(
      await readFilePromise(path.join(ROOT, "package.json"), "utf8")
    );
    const required = ["dev", "build", "rag:server", "preview", "test"];
    for (const script of required) {
      assert.ok(pkg.scripts[script], `Missing script: ${script}`);
    }
  });
});

describe("dist build output", () => {
  it("should contain built index.html and data files", () => {
    assert.ok(existsSync(path.join(ROOT, "dist", "index.html")), "dist/index.html");
    assert.ok(existsSync(path.join(ROOT, "dist", "data", "rag_evidence_layer.json")), "dist/data/rag_evidence_layer.json");
    assert.ok(existsSync(path.join(ROOT, "dist", "assets")), "dist/assets exists");
  });
});
