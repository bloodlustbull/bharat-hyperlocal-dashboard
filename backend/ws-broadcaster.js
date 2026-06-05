import { getStatus as getPipeline } from "./agents/index.js";
import { getMetrics } from "./observability.js";
import { getHealth } from "./health.js";
import { getAlerts } from "./alerts.js";
import { getHistory } from "./metrics-history.js";

const clients = new Set();
let interval = null;
const PUSH_INTERVAL_MS = 3000;

function makePayload() {
  return {
    type: "snapshot",
    timestamp: new Date().toISOString(),
    pipeline: getPipeline(),
    metrics: getMetrics(),
    health: getHealth(),
    alerts: getAlerts({ includeAcknowledged: false, limit: 20 }),
    history: getHistory({ windowMs: 900_000 })
  };
}

function pushToAll(payload) {
  const json = JSON.stringify(payload);
  for (const ws of clients) {
    try {
      if (ws.readyState === 1) ws.send(json);
    } catch (e) {
      console.warn("[ws] Push failed:", e.message);
    }
  }
}

function startBroadcaster() {
  if (interval) return;
  interval = setInterval(() => {
    if (clients.size === 0) return;
    pushToAll(makePayload());
  }, PUSH_INTERVAL_MS);
  console.log(`[ws] Broadcaster started (every ${PUSH_INTERVAL_MS/1000}s)`);
}

function stopBroadcaster() {
  if (interval) clearInterval(interval);
  interval = null;
}

function handleClient(ws) {
  clients.add(ws);
  console.log(`[ws] Client connected (${clients.size} total)`);
  try {
    ws.send(JSON.stringify({ type: "snapshot", timestamp: new Date().toISOString(), ...makePayload() }));
  } catch (e) {
    console.warn("[ws] Initial send failed:", e.message);
  }
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
      if (msg.type === "subscribe" && msg.channel) ws.send(JSON.stringify({ type: "subscribed", channel: msg.channel, timestamp: new Date().toISOString() }));
      if (msg.type === "request_snapshot") ws.send(JSON.stringify({ type: "snapshot", ...makePayload() }));
    } catch (e) { /* ignore non-JSON */ }
  });
  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[ws] Client disconnected (${clients.size} total)`);
  });
  ws.on("error", (e) => {
    console.warn("[ws] Client error:", e.message);
    clients.delete(ws);
  });
}

function broadcast(event) {
  pushToAll({ type: "event", timestamp: new Date().toISOString(), ...event });
}

function getStats() {
  return { clients: clients.size, pushIntervalMs: PUSH_INTERVAL_MS, broadcasting: !!interval };
}

export { handleClient, startBroadcaster, stopBroadcaster, broadcast, getStats };
