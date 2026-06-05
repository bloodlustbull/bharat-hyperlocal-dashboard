import { emit } from "./event-bus.js";
import { llm } from "../llm.js";

const REFRESH_MS = Math.max(60_000, Number(process.env.RESEARCH_REFRESH_MS || 6 * 60 * 60 * 1000));
const CACHE_TTL_MS = Math.max(60_000, Number(process.env.CAMPAIGN_CACHE_TTL_MS || 30 * 60 * 1000));

const CACHE = new Map();

const QUERIES = {
  blinkit: ["blinkit news today", "blinkit 10 minute grocery", "blinkit expansion cities"],
  zepto: ["zepto news today", "zepto 10 minute delivery", "zepto dark stores"],
  instamart: ["swiggy instamart news", "instamart expansion"],
  bigbasket: ["bigbasket tata news", "bigbasket financials"]
};

function cacheKey(brand, city) { return `${brand}|${city || ""}`; }

function cacheGet(brand, city) {
  const entry = CACHE.get(cacheKey(brand, city));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    CACHE.delete(cacheKey(brand, city));
    return null;
  }
  return entry.result;
}

async function cacheSet(brand, city, result) {
  CACHE.set(cacheKey(brand, city), { result, cachedAt: Date.now() });
}

async function tavilySearch(query) {
  if (!process.env.TAVILY_API_KEY) return [];
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 5,
      topic: "news",
      days: 7
    })
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(r => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
    published: r.published_date
  }));
}

async function fetchGoogleNewsRSS(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "BharatAgent/1.0" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [];
    const regex = /<item>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = regex.exec(xml)) !== null) {
      const block = m[1];
      const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
      const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || "";
      const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || "";
      const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1]?.trim() || "";
      if (title && link) items.push({ title: title.replace(/&amp;/g, "&"), url: link, source, published: pubDate });
      if (items.length >= 8) break;
    }
    return items;
  } catch { return []; }
}

async function gatherEvidence(brand, city) {
  const queries = (QUERIES[brand] || QUERIES.blinkit).map(q => city ? `${q} ${city}` : q);
  const out = [];
  for (const q of queries.slice(0, 3)) {
    const tavily = await tavilySearch(q).catch(() => []);
    const rss = await fetchGoogleNewsRSS(q);
    out.push({ query: q, tavily, rss });
  }
  return out;
}

async function summarizeWithLLM(brand, city, evidence) {
  const flat = [];
  for (const e of evidence) {
    for (const t of e.tavily) flat.push({ source: "tavily", title: t.title, content: t.content, url: t.url, published: t.published });
    for (const r of e.rss) flat.push({ source: r.source || "Google News", title: r.title, url: r.url, published: r.published });
  }
  if (!flat.length) return null;
  const messages = [
    {
      role: "system",
      content: "You are a sharp market intelligence analyst. Given raw news headlines, return ONLY valid JSON with the schema: {brand, city_or_market, summary (2-3 sentences), keyDevelopments (array of {headline, whyItMatters, citation, sentiment: positive|negative|neutral}), competitiveImplications (1-2 sentences for marketers), riskFactors (array of strings)}. Be specific, cite source titles, do not invent facts."
    },
    {
      role: "user",
      content: `Brand: ${brand}\nCity: ${city || "India-wide"}\n\nRaw news items (${flat.length}):\n${JSON.stringify(flat.slice(0, 25), null, 2)}\n\nReturn JSON.`
    }
  ];
  const result = await llm.json(messages, { maxTokens: 1800, temperature: 0.4 });
  if (!result.success) {
    return { brand, city, summary: `LLM unavailable: ${result.errors?.[0]?.error || "no provider"}`, keyDevelopments: [], competitiveImplications: "", riskFactors: [], sources: flat };
  }
  return { ...result.parsed, sources: flat, llmProvider: result.provider, llmModel: result.model, llmDurationMs: result.durationMs };
}

export async function runResearchAgent({ brand = "blinkit", city = "" } = {}, opts = {}) {
  const force = opts.force === true;
  const id = `research-${brand}-${Date.now()}`;
  emit({ type: "agent_start", agent: "research", runId: id, brand, city });
  const t0 = Date.now();
  try {
    if (!force) {
      const cached = cacheGet(brand, city);
      if (cached) {
        emit({ type: "agent_progress", agent: "research", runId: id, stage: "cache_hit", cachedAt: cached.timestamp });
        const replay = { ...cached, runId: id, durationMs: Date.now() - t0, fromCache: true, cacheTtlMs: CACHE_TTL_MS };
        emit({ type: "agent_complete", agent: "research", runId: id, result: replay, durationMs: replay.durationMs });
        return replay;
      }
    }
    const evidence = await gatherEvidence(brand, city);
    const totalRaw = evidence.reduce((s, e) => s + e.tavily.length + e.rss.length, 0);
    emit({ type: "agent_progress", agent: "research", runId: id, stage: "evidence_gathered", rawCount: totalRaw });
    const summary = await summarizeWithLLM(brand, city, evidence);
    const result = {
      runId: id,
      brand,
      city,
      evidence,
      summary,
      durationMs: Date.now() - t0,
      sources: totalRaw,
      timestamp: new Date().toISOString()
    };
    await cacheSet(brand, city, result);
    emit({ type: "agent_complete", agent: "research", runId: id, result, durationMs: result.durationMs });
    return result;
  } catch (e) {
    emit({ type: "agent_error", agent: "research", runId: id, error: e.message });
    throw e;
  }
}

export function getLastResearch(brand = "blinkit", city = "") {
  return cacheGet(brand, city);
}

export function getAllResearch() {
  return [...CACHE.values()].map(e => e.result);
}

export function clearResearchCache() { CACHE.clear(); }

export const researchAgent = { run: runResearchAgent, getLast: getLastResearch, getAll: getAllResearch, clearCache: clearResearchCache, refreshMs: REFRESH_MS, cacheTtlMs: CACHE_TTL_MS };
export default researchAgent;
