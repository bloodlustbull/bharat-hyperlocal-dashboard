import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CACHE_FILE = join(__dirname, "..", "data", "brief_cache.json");
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 200;
const memoryCache = new Map();

let stats = { hits: 0, misses: 0, writes: 0, evictions: 0 };
let writeTimer = null;

function makeKey(city, category, language, opts = {}) {
  const input = JSON.stringify({ city: city?.toLowerCase(), category: category?.toLowerCase(), language, ...opts });
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

async function loadFromDisk() {
  try {
    const data = JSON.parse(await readFile(CACHE_FILE, "utf8"));
    for (const [k, v] of Object.entries(data)) {
      if (Date.now() - v.cachedAt < TTL_MS) memoryCache.set(k, v);
    }
    console.log(`[brief-cache] Loaded ${memoryCache.size} valid cache entries from disk`);
  } catch (e) {
    if (e.code !== "ENOENT") console.warn("[brief-cache] Load failed:", e.message);
  }
}

async function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(async () => {
    writeTimer = null;
    try {
      const data = Object.fromEntries(memoryCache);
      await mkdir(dirname(CACHE_FILE), { recursive: true });
      await writeFile(CACHE_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.warn("[brief-cache] Persist failed:", e.message);
    }
  }, 5000);
}

function evictIfNeeded() {
  if (memoryCache.size <= MAX_ENTRIES) return;
  const sorted = [...memoryCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt);
  while (memoryCache.size > MAX_ENTRIES && sorted.length) {
    const [k] = sorted.shift();
    memoryCache.delete(k);
    stats.evictions++;
  }
}

function get(city, category, language, opts = {}) {
  const key = makeKey(city, category, language, opts);
  const entry = memoryCache.get(key);
  if (!entry) { stats.misses++; return null; }
  if (Date.now() - entry.cachedAt > TTL_MS) {
    memoryCache.delete(key);
    stats.misses++;
    return null;
  }
  stats.hits++;
  return entry.brief;
}

async function set(city, category, language, brief, opts = {}) {
  const key = makeKey(city, category, language, opts);
  const entry = { city, category, language, brief, cachedAt: Date.now(), meta: { source: opts.source || "local" } };
  memoryCache.set(key, entry);
  stats.writes++;
  evictIfNeeded();
  await persist();
  return entry;
}

function invalidate(predicate) {
  let count = 0;
  for (const [k, v] of memoryCache) {
    if (predicate(v)) {
      memoryCache.delete(k);
      count++;
    }
  }
  if (count) persist();
  return count;
}

function clear() {
  const n = memoryCache.size;
  memoryCache.clear();
  persist();
  return n;
}

function getStats() {
  return { ...stats, size: memoryCache.size, ttlMs: TTL_MS, maxEntries: MAX_ENTRIES };
}

await loadFromDisk();

export { get, set, invalidate, clear, getStats };
