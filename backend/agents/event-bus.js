const subscribers = new Set();

function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function emit(event) {
  const enriched = { ...event, timestamp: event.timestamp || new Date().toISOString() };
  for (const fn of subscribers) {
    try { fn(enriched); } catch (e) { console.warn("[bus] subscriber failed:", e.message); }
  }
  return enriched;
}

function clear() { subscribers.clear(); }
function size() { return subscribers.size; }

export { subscribe, emit, clear, size };
