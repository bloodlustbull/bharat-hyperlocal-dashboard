import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  getState, resetState, logEntry, startPipeline,
  setAgentStatus, markAgentStart, markAgentComplete, markAgentError
} from "./pipeline-store.js";
import { runIngestion } from "./ingestion-agent.js";
import { runScoring } from "./score-agent.js";
import { runBriefGeneration } from "./brief-agent.js";
import { recordPipelineRun } from "../observability.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..", "..");

function loadCities() {
  try {
    const data = JSON.parse(readFileSync(join(ROOT, "public", "data", "city_language_seed.json"), "utf-8"));
    const cities = (data.cities || []).map(c => c.city || c).filter(Boolean);
    if (cities.length) return cities;
  } catch {}
  try {
    const data = JSON.parse(readFileSync(join(ROOT, "data", "city_language_seed.json"), "utf-8"));
    const cities = (data.cities || []).map(c => c.city || c).filter(Boolean);
    if (cities.length) return cities;
  } catch {}
  return ["Hyderabad", "Mumbai", "Delhi", "Bangalore", "Chennai", "Pune", "Kolkata", "Ahmedabad"];
}

function loadCategories() {
  try {
    const data = JSON.parse(readFileSync(join(ROOT, "public", "data", "city_language_seed.json"), "utf-8"));
    const cats = data.categories || [];
    if (cats.length) return cats;
  } catch {}
  return ["Grocery", "Snacks", "Beverages", "Dairy", "Personal Care"];
}

const AGENT_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours
const STATE_CHECK_INTERVAL = 60000; // check every minute

let timers = [];
let isRunning = false;
let lastIngestionResult = null;
let lastScoreResult = null;
let lastBriefResult = null;

export function getStatus() {
  const s = getState();
  return {
    ...s,
    isRunning,
    lastIngestionResult,
    lastScoreResult,
    lastBriefResult,
    citiesCount: loadCities().length,
    categoriesCount: loadCategories().length
  };
}

export async function runAllAgents() {
  if (isRunning) return { error: "Pipeline already running" };
  isRunning = true;
  recordPipelineRun();
  logEntry("system", "info", "Running all agents");

  try {
    const cities = loadCities();
    const categories = loadCategories();

    lastIngestionResult = await runIngestion(cities, categories);
    lastScoreResult = await runScoring(cities, categories);
    lastBriefResult = await runBriefGeneration(cities, categories);

    logEntry("system", "info",
      `All agents complete: ${lastIngestionResult.newEvidence} new evidence (of ${lastIngestionResult.totalRecords} total), ` +
      `${lastScoreResult.scoreCount} scores computed, ` +
      `${lastBriefResult.briefsGenerated} briefs generated`
    );
  } catch (e) {
    logEntry("system", "error", `Pipeline run failed: ${e.message}`);
  } finally {
    isRunning = false;
  }

  return {
    ingestion: lastIngestionResult,
    score: lastScoreResult,
    brief: lastBriefResult,
    lastIngestionResult,
    lastScoreResult,
    lastBriefResult,
    newEvidence: lastIngestionResult?.newEvidence || 0,
    totalRecords: lastIngestionResult?.totalRecords || 0,
    deltasCount: lastScoreResult?.deltas?.length || 0,
    briefsCount: lastBriefResult?.briefsGenerated || 0
  };
}

export async function runAgent(name) {
  recordPipelineRun();
  const cities = loadCities();
  const categories = loadCategories();

  switch (name) {
    case "ingestion":
      lastIngestionResult = await runIngestion(cities, categories);
      return lastIngestionResult;
    case "score":
      lastScoreResult = await runScoring(cities, categories);
      return lastScoreResult;
    case "brief":
      lastBriefResult = await runBriefGeneration(cities, categories);
      return lastBriefResult;
    default:
      throw new Error(`Unknown agent: ${name}`);
  }
}

export function startOrchestrator() {
  logEntry("system", "info", "Orchestrator starting");
  startPipeline();

  // Schedule ingestion every 3 hours
  const ingestionTimer = setInterval(async () => {
    try {
      await runAgent("ingestion");
      await runAgent("score");
    } catch (e) {
      logEntry("system", "error", `Scheduled ingestion failed: ${e.message}`);
    }
  }, AGENT_INTERVAL);
  timers.push(ingestionTimer);

  // Schedule brief generation after score updates (3h + 5min offset)
  const briefTimer = setInterval(async () => {
    try {
      await runAgent("brief");
    } catch (e) {
      logEntry("system", "error", `Scheduled brief generation failed: ${e.message}`);
    }
  }, AGENT_INTERVAL + 300000);
  timers.push(briefTimer);

  logEntry("system", "info", `Orchestrator scheduled: ingestion every 3h, briefs every 3h+5min`);

  // Run initial ingestion + scoring after 30s startup delay
  setTimeout(async () => {
    logEntry("system", "info", "Running initial agent cycle");
    try {
      await runAllAgents();
    } catch (e) {
      logEntry("system", "error", `Initial agent cycle failed: ${e.message}`);
    }
  }, 30000);

  return timers;
}

export function stopOrchestrator() {
  for (const timer of timers) clearInterval(timer);
  timers = [];
  isRunning = false;
  logEntry("system", "info", "Orchestrator stopped");
}
