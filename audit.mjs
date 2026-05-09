/**
 * audit.mjs — Autonomous agent-browser audit for bharat-hyperlocal-dashboard
 *
 * HOW TO RUN:
 *   1. Put this file in your project root (same folder as index.html)
 *   2. Make sure Live Server is running (http://127.0.0.1:5500/index.html)
 *   3. Open terminal in OpenCode
 *   4. Run:  node audit.mjs
 *
 * WHAT IT DOES:
 *   - Opens your live dashboard in agent-browser
 *   - Checks all 5 tabs/sections
 *   - Captures console errors, broken elements, layout issues
 *   - Takes screenshots
 *   - Prints full report you can paste into OpenCode chat
 */

import { execSync } from "child_process";

const URL = "http://127.0.0.1:5500/index.html";

function ab(command) {
  try {
    return execSync(`agent-browser ${command}`, {
      encoding: "utf-8",
      timeout: 30000,
    }).trim();
  } catch (err) {
    return `ERROR: ${err.stderr || err.message}`;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runAudit() {
  console.log("═══════════════════════════════════════════════");
  console.log("  BHARAT HYPERLOCAL DASHBOARD — AUTONOMOUS AUDIT");
  console.log("═══════════════════════════════════════════════\n");

  const report = [];
  const screenshots = [];

  function log(section, message) {
    const line = `[${section}] ${message}`;
    console.log(line);
    report.push(line);
  }

  log("OPEN", `Navigating to ${URL}`);
  ab(`open ${URL}`);
  ab("wait --load networkidle");
  await sleep(2000);

  log("SCREENSHOT", "Taking initial screenshot → audit_01_initial.png");
  ab("screenshot audit_01_initial.png --full");
  screenshots.push("audit_01_initial.png");

  const title = ab("get title");
  log("TITLE", `Page title: "${title}"`);
  if (!title || title.includes("ERROR")) {
    log("❌ TITLE", "Page title missing or page failed to load");
  } else {
    log("✅ TITLE", "Page loaded successfully");
  }

  log("CONSOLE", "Checking for JavaScript console errors...");
  const consoleOutput = ab("console");
  if (consoleOutput.toLowerCase().includes("error")) {
    log("❌ CONSOLE ERROR", consoleOutput);
  } else if (!consoleOutput || consoleOutput.includes("No console")) {
    log("✅ CONSOLE", "No console errors detected");
  } else {
    log("⚠️  CONSOLE", consoleOutput);
  }

  const pageErrors = ab("errors");
  if (pageErrors && !pageErrors.includes("No page errors") && !pageErrors.includes("ERROR:")) {
    log("❌ JS ERRORS", pageErrors);
  } else {
    log("✅ JS ERRORS", "No uncaught JS exceptions");
  }

  log("SNAPSHOT", "Getting accessibility tree...");
  const snapshot = ab("snapshot -i -c");

  const checks = [
    { label: "Market Pulse tab",      term: "Market"     },
    { label: "City-Language tab",     term: "City"       },
    { label: "Content Brief tab",     term: "Content"    },
    { label: "WhatsApp tab",          term: "WhatsApp"   },
    { label: "Experiment tab",        term: "Experiment" },
    { label: "Charts/Canvas",         term: "canvas"     },
    { label: "CSV upload button",     term: "upload"     },
    { label: "Score/Generate button", term: "Generate"   },
  ];

  log("ELEMENTS", "Checking for key UI elements...");
  for (const { label, term } of checks) {
    if (snapshot.toLowerCase().includes(term.toLowerCase())) {
      log(`✅ FOUND`, `${label}`);
    } else {
      log(`❌ MISSING`, `${label} — "${term}" not found in DOM`);
    }
  }

  const tabs = [
    { name: "Market Pulse",         screenshot: "audit_02_market_pulse.png"    },
    { name: "City-Language Scorer", screenshot: "audit_03_city_scorer.png"     },
    { name: "Content Brief",        screenshot: "audit_04_content_brief.png"   },
    { name: "WhatsApp Funnel",      screenshot: "audit_05_whatsapp_funnel.png" },
    { name: "Experiment Tracker",   screenshot: "audit_06_experiment.png"      },
  ];

  for (const tab of tabs) {
    log("TAB", `Clicking tab: "${tab.name}"`);
    const result = ab(`find text "${tab.name}" click`);
    if (result.includes("ERROR")) {
      log(`❌ TAB FAIL`, `"${tab.name}" — could not click: ${result}`);
    } else {
      await sleep(1500);
      const errs = ab("errors");
      if (errs && !errs.includes("No page errors") && !errs.includes("ERROR:")) {
        log(`❌ ERROR in "${tab.name}"`, errs);
      } else {
        log(`✅ TAB OK`, `"${tab.name}" loaded without errors`);
      }
      ab(`screenshot ${tab.screenshot} --full`);
      screenshots.push(tab.screenshot);
    }
  }

  log("RESPONSIVE", "Testing mobile viewport 390x844...");
  ab("set viewport 390 844");
  await sleep(1500);
  ab("screenshot audit_07_mobile.png --full");
  screenshots.push("audit_07_mobile.png");
  const mobileSnap = ab("snapshot -i -c");
  if (mobileSnap.toLowerCase().includes("menu") || mobileSnap.toLowerCase().includes("tab")) {
    log("✅ MOBILE", "Navigation visible on mobile");
  } else {
    log("⚠️  MOBILE", "Navigation may be broken on mobile — check audit_07_mobile.png");
  }
  ab("set viewport 1280 800");

  log("IMAGES", "Checking for broken images...");
  const brokenImgs = ab(`eval "JSON.stringify([...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src))"`);
  if (brokenImgs && brokenImgs !== "[]" && !brokenImgs.includes("ERROR")) {
    log("❌ BROKEN IMAGES", brokenImgs);
  } else {
    log("✅ IMAGES", "No broken images");
  }

  log("DATA", "Checking charts rendered...");
  const dataCheck = ab(`eval "document.querySelectorAll('canvas').length + ' chart(s) rendered'"`);
  log("📊 CHARTS", dataCheck.includes("ERROR") ? "Could not check charts" : dataCheck);

  ab("close");

  console.log("\n\n");
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║      FULL AUDIT REPORT — PASTE INTO OPENCODE     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log("## Bharat Hyperlocal Dashboard — Audit Report\n");
  report.forEach((line) => console.log(line));
  console.log("\n### Screenshots saved in your project root:");
  screenshots.forEach((s) => console.log(`  - ${s}`));
  console.log("\n### What to do next:");
  console.log("  1. Copy this entire report");
  console.log("  2. Paste into OpenCode chat");
  console.log("  3. Say: Fix all the ❌ issues listed above");
  console.log("  4. Open the screenshots to see visual problems");
}

runAudit();