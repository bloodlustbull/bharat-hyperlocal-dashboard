import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0, warnings = [];

function check(condition, label) {
  if (condition) { pass++; }
  else { fail++; warnings.push("FAIL: " + label); }
}

// ===== 1. SCRIPT LOADING ANALYSIS =====
const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)];
console.log("--- Script loading analysis ---");
for (const s of scripts) {
  const type = s[0].match(/type="([^"]+)"/)?.[1] || "regular";
  const exists = existsSync(join(ROOT, s[1]));
  check(exists, "Script file exists: " + s[1]);
  const isModule = s[0].includes('type="module"');
  const isMain = s[1].includes("main.js");
  const isApp = s[1].includes("app.js");
  if (isMain) check(true, "src/main.js loaded as module: " + isModule);
  if (isApp) check(!isModule, "app.js loaded as regular script (not module): " + !isModule);
  console.log("  " + (exists ? "OK" : "MISSING") + " type=" + type + (isModule ? " [module]" : "") + " " + s[1]);
}

// ===== 2. CSS ANALYSIS =====
console.log("\n--- CSS analysis ---");
const cssRefs = [...html.matchAll(/href="([^"]+\.css)"/g)];
for (const c of cssRefs) {
  const exists = existsSync(join(ROOT, c[1]));
  check(exists, "CSS file exists: " + c[1]);
  console.log("  " + (exists ? "OK" : "MISSING") + " " + c[1]);
}

// Check CSS content overlap
if (existsSync(join(ROOT, "styles.css")) && existsSync(join(ROOT, "src", "styles", "main.css"))) {
  const css1 = readFileSync(join(ROOT, "styles.css"), "utf8");
  const css2 = readFileSync(join(ROOT, "src", "styles", "main.css"), "utf8");
  // Check if they define overlapping rules for #three-overlay
  const threeOverlay1 = css1.includes("#three-overlay") || css1.includes("three-overlay");
  const threeOverlay2 = css2.includes("#three-overlay") || css2.includes("three-overlay");
  if (threeOverlay1 && threeOverlay2) {
    console.log("  WARNING: Both styles.css and src/styles/main.css define #three-overlay rules — potential conflict");
  }
}

// ===== 3. ASSET CHECK =====
console.log("\n--- Asset check ---");
function walkAssets(dir, subdir) {
  const full = join(ROOT, dir, subdir);
  if (!existsSync(full)) return;
  for (const e of readdirSync(full, { withFileTypes: true })) {
    if (e.isDirectory()) walkAssets(dir, join(subdir, e.name));
  }
}
// Check hero sprites
const heroDir = join(ROOT, "public", "assets", "hero", "items");
if (existsSync(heroDir)) {
  for (const f of readdirSync(heroDir)) {
    const full = join(heroDir, f);
    if (statSync(full).isFile()) {
      const referenced = html.includes(f);
      check(referenced, "Hero sprite referenced in HTML: " + f);
      if (!referenced) console.log("  ORPHANED: " + f + " (not referenced in index.html)");
    }
  }
}

// Check referenced sprites exist
const imgRefs = [...html.matchAll(/src="assets\/hero\/items\/([^"]+)"/g)];
for (const r of imgRefs) {
  const exists = existsSync(join(ROOT, "public", "assets", "hero", "items", r[1]));
  check(exists, "Referenced sprite exists: " + r[1]);
}

// ===== 4. APP.JS STRUCTURE =====
console.log("\n--- app.js structure ---");
const app = readFileSync(join(ROOT, "app.js"), "utf8");
const appLines = app.split("\n");

// Find the $ helper function
const dollarLine = appLines.findIndex(l => l.includes("function $(") || l.includes("const $ ="));
if (dollarLine >= 0) {
  console.log("  $() helper defined at line " + (dollarLine + 1));
}

// Check init is called at the bottom
const initCall = appLines.filter((l, i) => l.includes("init();") && i > 4000);
check(initCall.length > 0, "init() called at bottom of app.js");

// Check for obvious undefined variables
const undefinedChecks = ["FALLBACK_MARKET_DATA", "FALLBACK_SEED_DATA", "$", "escapeHtml", "showTab",
  "getPlatforms", "selectedPlatform", "calculateScore", "setView", "showLanding",
  "seedData", "marketData", "marketSignals", "ragEvidenceLayer", "caCsvData",
  "cityFor", "renderKpis", "renderPlatformIntelligence", "renderCampaignStatus",
  "renderMarketPulse", "renderProofCards", "renderSources", "renderScore",
  "renderCampaignAutopilot", "renderVideoCampaignStudio", "renderGeoSalesCommandCenter",
  "renderExperimentPlan", "renderUnitEconomics", "renderReport", "renderOeSignals",
  "renderPriceWatchTable", "renderPriceWatchAlerts", "renderPriceWatchTrend",
  "renderBenchmarkCockpit", "renderRagLayer", "attachEvents", "loadMarketSignals",
  "populateRagControls", "populatePlatformControls", "populateSeedControls",
  "populateConsumerSignalControls", "populatePriceWatchControls",
  "setActivePlatform", "renderTopSignals", "renderSignalTimeline", "renderSignalBrandMap",
  "updateOEEvidenceFromSignals", "updateCockpitFromSignals", "updateAutopilotFromSignals",
  "getRagApiUrl", "ragStatus"];

for (const name of undefinedChecks) {
  const defined = app.includes("function " + name + "(") ||
                  app.includes("const " + name + " ") ||
                  app.includes("let " + name + " ") ||
                  app.includes("var " + name + " ") ||
                  app.includes("window." + name + " =");
  check(defined, "app.js defines: " + name);
}

// ===== 5. DATA FILE CONSISTENCY =====
console.log("\n--- Data file consistency ---");
const dataDir = join(ROOT, "data");
const publicDataDir = join(ROOT, "public", "data");
if (existsSync(dataDir) && existsSync(publicDataDir)) {
  const dataFiles = readdirSync(dataDir).filter(f => f.endsWith(".json"));
  const publicFiles = readdirSync(publicDataDir).filter(f => f.endsWith(".json"));
  for (const f of dataFiles) {
    const inPublic = publicFiles.includes(f);
    check(inPublic, "public/data/ has: " + f);
    if (!inPublic) console.log("  MISSING from public/data/: " + f);
  }
  // Check for stale files in public that aren't in data
  for (const f of publicFiles) {
    if (!dataFiles.includes(f) && f !== "campaign_template.csv") {
      console.log("  STALE in public/data/: " + f + " (not in data/)");
    }
  }
}

// ===== 6. PACKAGE.JSON CONSISTENCY =====
console.log("\n--- package.json ---");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const requiredScripts = ["dev", "build", "prebuild", "rag:server", "test", "preview", "start"];
for (const s of requiredScripts) {
  check(!!pkg.scripts[s], "package.json script: " + s);
}
check(pkg.type === "module", "package.json type: module");

// ===== 7. BACKEND ANALYSIS =====
console.log("\n--- Backend analysis ---");
const backendSrc = readFileSync(join(ROOT, "backend", "server.js"), "utf8");
const endpoints = ["/brief", "/ingest", "/evidence", "/health", "/assistant"];
for (const ep of endpoints) {
  check(backendSrc.includes(ep), "Backend endpoint: " + ep);
}

// Check .env.local exists
check(existsSync(join(ROOT, "backend", ".env.local")), "backend/.env.local exists");

// Check PDF docs
const docsDir = join(ROOT, "docs");
if (existsSync(docsDir)) {
  const hasPdf = readdirSync(docsDir).some(f => f.endsWith(".pdf"));
  if (hasPdf) console.log("  NOTE: PDF docs not analyzed: " + readdirSync(docsDir).filter(f => f.endsWith(".pdf")).join(", "));
}

// ===== 8. THREE.JS SCENE ANALYSIS =====
console.log("\n--- Three.js scene analysis ---");
const sceneFiles = ["src/main.js", "src/scene/createScene.js", "src/scene/lights.js",
  "src/scene/particles.js", "src/scene/brandObjects.js", "src/scene/interactions.js",
  "src/scene/responsive.js", "src/styles/main.css"];
for (const f of sceneFiles) {
  check(existsSync(join(ROOT, f)), "Scene file exists: " + f);
}

// ===== 9. CONSOLE.LOG/WARN/ERROR CLEANLINESS =====
console.log("\n--- Console statement analysis ---");
const consoleStmts = appLines.filter((l, i) => {
  const trimmed = l.trim();
  return (trimmed.includes("console.log") || trimmed.includes("console.warn") || trimmed.includes("console.error"))
    && !trimmed.startsWith("//");
});
check(consoleStmts.length <= 5, "Minimal console.log/warn/error in app.js: " + consoleStmts.length);
if (consoleStmts.length > 5) {
  console.log("  Console statements:");
  consoleStmts.forEach((l, i) => console.log("    " + l.trim().slice(0, 100)));
}

// ===== 10. VOICE-ASSISTANT INTEGRATION =====
console.log("\n--- Voice assistant integration ---");
const vaLoaded = html.includes("voice-assistant.js");
check(vaLoaded, "voice-assistant.js loaded in index.html");

// ===== SUMMARY =====
console.log("\n══════════════════════════════════════════");
console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
console.log("══════════════════════════════════════════");
if (fail > 0) {
  console.log("\nFAILURES:");
  warnings.filter(w => w.startsWith("FAIL")).forEach(w => console.log("  " + w));
}
process.exit(fail > 0 ? 1 : 0);
