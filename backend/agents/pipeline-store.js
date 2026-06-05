import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const PIPELINE_FILE = join(DATA_DIR, "pipeline_state.json");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const defaultState = {
  agents: {
    ingestion: {
      status: "idle",
      lastRun: null,
      lastDuration: null,
      lastError: null,
      runCount: 0,
      itemsProcessed: 0,
      nextRun: null,
      schedule: "every 3 hours"
    },
    score: {
      status: "idle",
      lastRun: null,
      lastDuration: null,
      lastError: null,
      runCount: 0,
      itemsProcessed: 0,
      nextRun: null,
      schedule: "after ingestion"
    },
    brief: {
      status: "idle",
      lastRun: null,
      lastDuration: null,
      lastError: null,
      runCount: 0,
      itemsProcessed: 0,
      nextRun: null,
      schedule: "on demand or after score"
    }
  },
  pipeline: {
    startedAt: null,
    totalRuns: 0,
    lastActivity: null,
    uptime: null
  },
  log: []
};

let state = loadState();

function loadState() {
  try {
    if (existsSync(PIPELINE_FILE)) {
      return JSON.parse(readFileSync(PIPELINE_FILE, "utf-8"));
    }
  } catch {}
  return JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
  try {
    writeFileSync(PIPELINE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("Pipeline store save failed:", e.message);
  }
}

export function getState() {
  return JSON.parse(JSON.stringify(state));
}

export function resetState() {
  state = JSON.parse(JSON.stringify(defaultState));
  saveState();
}

export function logEntry(agent, type, message, data) {
  state.log.unshift({
    agent,
    type,
    message,
    data: data || null,
    timestamp: new Date().toISOString()
  });
  if (state.log.length > 200) state.log.length = 200;
  state.pipeline.lastActivity = new Date().toISOString();
  saveState();
}

export function startPipeline() {
  state.pipeline.startedAt = new Date().toISOString();
  state.pipeline.uptime = Date.now();
  logEntry("system", "info", "Pipeline started");
}

export function markAgentStart(agentName) {
  if (!state.agents[agentName]) return;
  state.agents[agentName].status = "running";
  state.agents[agentName].lastError = null;
  saveState();
}

export function markAgentComplete(agentName, itemsProcessed, durationMs) {
  if (!state.agents[agentName]) return;
  const agent = state.agents[agentName];
  agent.status = "idle";
  agent.lastRun = new Date().toISOString();
  agent.lastDuration = durationMs;
  agent.runCount++;
  agent.itemsProcessed += itemsProcessed;
  state.pipeline.totalRuns++;
  agent.nextRun = agentName === "ingestion"
    ? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    : null;
  saveState();
  logEntry(agentName, "complete", `Completed: ${itemsProcessed} items in ${durationMs}ms`);
}

export function markAgentError(agentName, error) {
  if (!state.agents[agentName]) return;
  state.agents[agentName].status = "error";
  state.agents[agentName].lastError = error.message || String(error);
  state.agents[agentName].lastRun = new Date().toISOString();
  saveState();
  logEntry(agentName, "error", `Error: ${error.message || error}`);
}

export function setAgentStatus(agentName, status) {
  if (!state.agents[agentName]) return;
  state.agents[agentName].status = status;
  saveState();
}

export function getLog(limit = 50) {
  return state.log.slice(0, limit);
}

export function getAgentLog(agentName, limit = 20) {
  return state.log.filter(e => e.agent === agentName).slice(0, limit);
}
