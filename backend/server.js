import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSecureConfig, getOpenAiConfig, getProviderStatus } from "./secure-config.js";
import { getRotatingOpenAiKey } from "./rotate-key.js";
import * as pipeline from "./agents/index.js";
import { getMetrics, getPrometheusMetrics, recordRequest } from "./observability.js";
import { getHealth, getReadiness } from "./health.js";
import * as briefCache from "./brief-cache.js";
import * as rateLimiter from "./rate-limiter.js";
import * as alerts from "./alerts.js";
import { startAutoFlush as startMetricsHistory, stopAutoFlush as stopMetricsHistory, getHistory as getMetricsHistory, getSummary as getMetricsSummary } from "./metrics-history.js";
import { llm, getLLMProviderStatus } from "./llm.js";
import researchAgent, { getAllResearch as getAllResearchSummaries } from "./agents/research-agent.js";
import audienceAgent from "./agents/audience-agent.js";
import copyAgent from "./agents/copy-agent.js";
import channelAgent from "./agents/channel-agent.js";
import complianceAgent from "./agents/compliance-agent.js";
import { runCampaignChain, getActiveRuns as getActiveCampaignRuns, getHistory as getCampaignHistory, shutdown as shutdownOrchestrator, DEFAULT_INPUT as CAMPAIGN_DEFAULTS } from "./agents/orchestrator.js";
import { subscribe as subscribeBus, size as busSize } from "./agents/event-bus.js";
import { WebSocketServer } from "ws";
import { handleClient as wsHandleClient, startBroadcaster as startWsBroadcaster, stopBroadcaster as stopWsBroadcaster, broadcast as wsBroadcast, getStats as getWsStats } from "./ws-broadcaster.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const EVIDENCE_FILE = path.join(DATA_DIR, "evidence_pack.local.json");
const SECURE_CONFIG = await loadSecureConfig({ root: ROOT });

const PORT = Number(process.env.RAG_PORT || process.env.PORT || 8787);
const PROVIDERS = getProviderStatus(SECURE_CONFIG);
const OPENAI_CONFIG = getOpenAiConfig(SECURE_CONFIG);
const OPENAI_BASE_URL = OPENAI_CONFIG.baseUrl;
const OLLAMA_CONFIG = SECURE_CONFIG.ollama;

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

async function readJsonFile(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function confidenceFromSource(sourceName = "", sourceType = "") {
  const value = `${sourceName} ${sourceType}`.toLowerCase();
  if (value.includes("filing") || value.includes("official") || value.includes("google ads api")) return "A";
  if (value.includes("tavily") || value.includes("firecrawl") || value.includes("news") || value.includes("report")) return "B";
  if (value.includes("reddit") || value.includes("youtube") || value.includes("instagram") || value.includes("review")) return "C";
  return "D";
}

function normalizeEvidence(raw, context = {}, source = {}) {
  const idBase = raw.id || raw.url || raw.source_url || raw.title || raw.claim || Date.now();
  const sourceName = raw.source_name || source.name || raw.source || raw.title || "Evidence source";
  const sourceUrl = raw.source_url || raw.url || source.url || "";
  const text = raw.evidence_text || raw.content || raw.snippet || raw.summary || raw.claim || raw.title || "";
  return {
    id: raw.id || `${slug(context.city || "market")}-${slug(sourceName)}-${slug(idBase).slice(0, 24)}`,
    city: context.city || raw.city || "Hyderabad",
    category: context.category || raw.category || "snacks",
    source_type: raw.source_type || source.type || "web",
    source_name: sourceName,
    source_url: sourceUrl,
    captured_at: raw.captured_at || new Date().toISOString(),
    claim: raw.claim || raw.title || text.slice(0, 180),
    evidence_text: text.slice(0, 1200),
    confidence: raw.confidence || confidenceFromSource(sourceName, raw.source_type || source.type),
    needs_validation: Boolean(raw.needs_validation ?? (!sourceUrl && !raw.source_url)),
    tags: [...new Set([context.city, context.language, context.category, ...(raw.tags || [])].filter(Boolean))]
  };
}

async function loadStoredEvidence() {
  return readJsonFile(EVIDENCE_FILE, { version: new Date().toISOString().slice(0, 10), evidence: [] });
}

async function saveEvidence(records) {
  await mkdir(DATA_DIR, { recursive: true });
  const current = await loadStoredEvidence();
  const byId = new Map((current.evidence || []).map(item => [item.id, item]));
  records.forEach(item => byId.set(item.id, item));
  const payload = {
    version: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
    evidence: [...byId.values()].slice(-500)
  };
  await writeFile(EVIDENCE_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

function localEvidenceFromPayload(payload) {
  const context = payload.context || {};
  const local = payload.localEvidence || {};
  const signals = (local.marketSignals || []).map(signal => normalizeEvidence({
    id: signal.id,
    source_type: signal.source_type || signal.sourceType || "market_signal",
    source_name: signal.source_name,
    source_url: signal.source_url,
    claim: signal.signal_summary,
    evidence_text: signal.signal_summary,
    confidence: signal.confidence,
    needs_validation: signal.needs_validation,
    tags: signal.dashboard_module_mapping || []
  }, context));

  const sample = (local.sampleEvidence || []).map(item => normalizeEvidence(item, context));
  const sources = (local.marketSources || []).slice(0, 8).map(source => normalizeEvidence({
    source_type: source.type || "dashboard_source",
    source_name: source.name,
    source_url: source.url,
    claim: source.usedFor,
    evidence_text: `${source.usedFor || ""} ${source.dateOrYear || ""}`.trim(),
    confidence: source.type,
    tags: ["dashboard_source"]
  }, context));

  return [...sample, ...signals, ...sources].filter(item => item.evidence_text || item.claim);
}

async function tavilySearch(query, context) {
  if (!process.env.TAVILY_API_KEY || !query) return [];
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 5
    })
  });
  if (!response.ok) throw new Error(`Tavily search failed with ${response.status}`);
  const data = await response.json();
  return (data.results || []).map(result => normalizeEvidence({
    source_type: "tavily_search",
    source_name: result.title || "Tavily result",
    source_url: result.url,
    claim: result.title || result.content,
    evidence_text: result.content || data.answer || result.title,
    confidence: "B",
    tags: ["tavily", "live_search"]
  }, context));
}

async function redditSearch(query, context) {
  if (!query) return [];
  const subreddit = context.city === "Hyderabad" ? "hyderabad" : "india";
  const searchQuery = encodeURIComponent(`${query} ${context.city || ""}`);
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${searchQuery}&sort=new&limit=10&t=month`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "BharatHyperlocalEvidenceBot/1.0" }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data?.children || []).map(child => {
      const post = child.data;
      return normalizeEvidence({
        source_type: "reddit_search",
        source_name: `r/${post.subreddit} — ${post.author}`,
        source_url: `https://www.reddit.com${post.permalink}`,
        claim: post.title,
        evidence_text: (post.selftext || post.title || "").slice(0, 1200),
        confidence: "C",
        tags: ["reddit", "consumer_voice", post.subreddit]
      }, context);
    });
  } catch {
    return [];
  }
}

async function googleNewsRSS(query, context) {
  if (!query) return [];
  const searchQuery = encodeURIComponent(`${query} ${context.city || "India"}`);
  const url = `https://news.google.com/rss/search?q=${searchQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "BharatHyperlocalEvidenceBot/1.0" }
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
      const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || "";
      const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || "";
      const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1]?.trim() || "";
      if (title && link) {
        items.push(normalizeEvidence({
          source_type: "google_news_rss",
          source_name: source || "Google News",
          source_url: link,
          claim: title.replace(/&amp;/g, "&"),
          evidence_text: title.replace(/&amp;/g, "&"),
          confidence: "B",
          captured_at: pubDate ? new Date(pubDate).toISOString() : undefined,
          tags: ["google_news", "market_signal"]
        }, context));
      }
    }
    return items.slice(0, 10);
  } catch {
    return [];
  }
}

async function googleTrendsRSS(query, context) {
  if (!query) return [];
  const searchQuery = encodeURIComponent(query);
  const geo = context.city === "Hyderabad" ? "IN-TS" : "IN";
  const url = `https://trends.google.com/trends/rss?geo=${geo}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "BharatHyperlocalEvidenceBot/1.0" }
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
      const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || "";
      const description = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]?.trim() || "";
      if (title && link) {
        items.push(normalizeEvidence({
          source_type: "google_trends_rss",
          source_name: `Google Trends — ${title}`,
          source_url: link,
          claim: description || title,
          evidence_text: description || title,
          confidence: "B",
          tags: ["google_trends", "search_demand"]
        }, context));
      }
    }
    return items.slice(0, 10);
  } catch {
    return [];
  }
}

async function fetchReadablePage(url, context) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const response = await fetch(url, { headers: { "User-Agent": "BharatHyperlocalEvidenceBot/1.0" } });
  if (!response.ok) return null;
  const html = await response.text();
  const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/\s+/g, " ").trim();
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1800);
  return normalizeEvidence({
    source_type: "page_fetch",
    source_name: title || new URL(url).hostname,
    source_url: url,
    claim: title || `Fetched ${url}`,
    evidence_text: body,
    confidence: "B",
    tags: ["url_extract"]
  }, context);
}

async function ingestEvidence(payload) {
  const job = payload.job || {};
  const city = payload.city || payload.context?.city || "Hyderabad";
  const category = payload.context?.category || "snacks";
  const language = payload.context?.language || "Telugu";
  const context = { city, category, language };
  const records = [];

  // Free connectors (no API keys needed)
  for (const query of job.queries || []) {
    // Reddit public JSON API (free, no key)
    try {
      records.push(...await redditSearch(query, context));
    } catch (error) {
      records.push(normalizeEvidence({
        source_type: "ingest_error",
        source_name: "Reddit",
        claim: `Could not ingest query: ${query}`,
        evidence_text: error.message,
        confidence: "D",
        needs_validation: true,
        tags: ["ingest_error"]
      }, context));
    }

    // Google News RSS (free, no key)
    try {
      records.push(...await googleNewsRSS(query, context));
    } catch (error) {
      records.push(normalizeEvidence({
        source_type: "ingest_error",
        source_name: "Google News",
        claim: `Could not ingest query: ${query}`,
        evidence_text: error.message,
        confidence: "D",
        needs_validation: true,
        tags: ["ingest_error"]
      }, context));
    }

    // Google Trends RSS (free, no key)
    try {
      records.push(...await googleTrendsRSS(query, context));
    } catch (error) {
      records.push(normalizeEvidence({
        source_type: "ingest_error",
        source_name: "Google Trends",
        claim: `Could not ingest query: ${query}`,
        evidence_text: error.message,
        confidence: "D",
        needs_validation: true,
        tags: ["ingest_error"]
      }, context));
    }

    // Tavily (needs API key)
    try {
      records.push(...await tavilySearch(query, context));
    } catch (error) {
      records.push(normalizeEvidence({
        source_type: "ingest_error",
        source_name: "Tavily",
        claim: `Could not ingest query: ${query}`,
        evidence_text: error.message,
        confidence: "D",
        needs_validation: true,
        tags: ["ingest_error"]
      }, context));
    }
  }

  for (const url of payload.urls || []) {
    const record = await fetchReadablePage(url, context);
    if (record) records.push(record);
  }

  if (!records.length) {
    records.push(normalizeEvidence({
      source_type: "backend_readiness",
      source_name: "RAG backend",
      claim: "Backend is running, but no live provider keys or URLs produced evidence.",
      evidence_text: "Set TAVILY_API_KEY for live web discovery, OPENAI_API_KEY for AI brief generation, and provider-specific keys for structured scraping.",
      confidence: "D",
      needs_validation: true,
      tags: ["backend", "configuration"]
    }, context));
  }

  const saved = await saveEvidence(records);
  return { status: "accepted", job_id: `rag-${Date.now()}`, inserted: records.length, providers: PROVIDERS, evidence: records, store: saved };
}

function buildFallbackBrief(payload, evidence) {
  const context = payload.context || {};
  const city = context.city || "Hyderabad";
  const lang = context.language || "Telugu";
  const category = context.category || "snacks";
  const platform = context.platform || "quick-commerce";
  const objective = context.objective || "First order";
  const channel = context.channel || "WhatsApp broadcast";

  const highConf = evidence.filter(item => ["A", "B"].includes(item.confidence));
  const directional = evidence.filter(item => !["A", "B"].includes(item.confidence));
  const newsItems = evidence.filter(e => e.source_type === "google_news_rss").slice(0, 3);
  const sourceTypes = [...new Set(evidence.map(e => e.source_type))];
  const citationLine = highConf.slice(0, 6).map(item => `${item.claim} [${item.id}]`).join(" ");

  return {
    mode: "backend_deterministic",
    generatedAt: new Date().toISOString(),
    city,
    language: lang,
    category,
    platform,
    objective,
    channel,
    score: payload.localEvidence?.score || null,
    sections: [
      {
        title: "1. Executive Summary",
        body: `${city} × ${lang} × ${category} on ${platform}. ${highConf.length} high-confidence evidence items, ${directional.length} directional observations, ${newsItems.length} recent news articles. The market opportunity is ${highConf.length > 3 ? "validated by multiple sources" : "emerging — additional ingestion recommended before committing budget"}. Primary channel: ${channel}.`
      },
      {
        title: "2. Search Demand & Keyword Opportunity",
        body: `Evidence includes ${sourceTypes.join(", ")} sources. ${highConf.filter(e => e.tags?.includes("market_signal")).length > 0 ? `${highConf.filter(e => e.tags?.includes("market_signal")).length} market signals indicate active search demand for ${category} in ${city}.` : `Run keyword research with Google Trends RSS and Tavily to establish baseline search demand for ${city} ${lang} ${category}.`} Content gap: few brands create ${lang} content for ${city} ${category} queries.`
      },
      {
        title: "3. Competitive Intelligence",
        body: highConf.filter(e => e.source_type === "tavily_search" || e.source_type === "google_news_rss").slice(0, 4).map(e => `${e.claim} [${e.id}]`).join(" ") || "No competitor intelligence ingested yet. Run Tavily search with competitor names + city to surface competitive signals."
      },
      {
        title: "4. Vernacular Content Strategy",
        body: `Create ${lang}-first landing pages, video content (Reels/Shorts), and WhatsApp broadcasts for ${city}. ${lang} voice search is growing. Implement hreflang tags for ${lang}-IN. The vernacular content gap is the primary growth wedge — most competitors optimise English/Hindi only.`
      },
      {
        title: "5. Campaign Recommendations",
        body: `(1) ${lang}-First Landing Page Blitz — capture ${lang} search demand. (2) "${city} Tastes Better in ${lang}" Video Series — YouTube Shorts + Reels. (3) WhatsApp Broadcast in ${lang} for ${category} offers — ${channel} direct. (4) ${city} ${platform} Hyperlocal Flash — time-bound promos in ${lang}. (5) Newsjacking — tie offers to trending ${category} news in ${city}.`
      },
      {
        title: "6. Search Intent & Funnel Mapping",
        body: `Top: Informational — ${lang} ${category} ${city} → blogs, GBP, Discovery ads. Mid: Commercial — best ${category} ${city} → comparison content, reviews. Bottom: Transactional — order ${category} ${city} → promo pages, WhatsApp order links. Post: Retention — ${lang} push + broadcast with repeat offers.`
      },
      {
        title: "7. Measurement & KPIs",
        body: `Primary: ${lang} Search Visibility (GSC), ${lang} ad CTR > 3.5%, WhatsApp click-to-order > 12%, First-order CAC < target, Repeat rate > 25% within 30 days. Track ${lang} Share of Voice — target >15% in 90 days.`
      },
      {
        title: "8. Prioritized Action Plan",
        body: `P0: Save RAG endpoint, ingest live data, run keyword research. P1: Create ${lang} landing pages, set up WhatsApp broadcast. P2: Google Business Profile in ${lang}, hreflang + schema, brief micro-influencers. P3: Launch ${city} ${lang} campaign. P4: Scale to adjacent categories. Primary citations: ${citationLine || "Run live ingestion first."}`
      }
    ],
    citations: evidence.slice(0, 15).map(item => ({
      id: item.id,
      source_name: item.source_name,
      source_url: item.source_url,
      confidence: item.confidence
    }))
  };
}

function extractOutputText(response) {
  if (response.output_text) return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

async function openAiBrief(payload, evidence) {
  const openAiKey = getRotatingOpenAiKey(SECURE_CONFIG);
  if (!openAiKey) return null;
  const fallback = buildFallbackBrief(payload, evidence);
  const prompt = {
    context: payload.context,
    required_output_shape: "Return JSON only with keys: mode, generatedAt, city, language, category, platform, objective, channel, score, sections[{title,body}], citations[{id,source_name,source_url,confidence}].",
    sections: [
      "1. Executive Summary — City × Language × Category opportunity snapshot with scores and evidence counts.",
      "2. Search Demand & Keyword Opportunity — What people search, keyword themes, content gaps.",
      "3. Competitive Intelligence — What competitors are doing, gaps to exploit, citing evidence IDs.",
      "4. Vernacular Content Strategy — Language-specific content recommendations, voice search, community tactics.",
      "5. Campaign Recommendations — 3-5 specific campaign concepts with channels, hooks, and rationale.",
      "6. Search Intent & Funnel Mapping — Top/Mid/Bottom/Post funnel actions with KPIs.",
      "7. Measurement & KPI Framework — Concrete metrics to track, targets to hit.",
      "8. Prioritized Action Plan — P0-P4 actions with owners and timelines."
    ],
    rules: [
      "Use only supplied evidence — every claim must cite evidence IDs in the body.",
      "Do not invent metrics, sources, screenshots, trend volume, app-review location, or campaign performance.",
      "If evidence is weak, say exactly what must be validated and how.",
      "Be specific about the city, language, and category — generate actionable campaign recommendations.",
      "Think like a professional SEO consultant for Indian vernacular markets."
    ],
    fallback_shape: fallback,
    evidence
  };

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openAiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_CONFIG.model,
      instructions: "You are a senior SEO consultant specializing in Indian vernacular markets and quick-commerce. Generate actionable, evidence-grounded briefs. Return compact valid JSON only.",
      input: JSON.stringify(prompt)
    })
  });
  if (!response.ok) throw new Error(`OpenAI brief failed with ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = extractOutputText(data);
  try {
    return JSON.parse(text);
  } catch {
    return { ...fallback, mode: "backend_ai_text", sections: [{ title: "AI brief", body: text }], citations: fallback.citations };
  }
}

async function ollamaBrief(payload, evidence) {
  if (!OLLAMA_CONFIG.enabled) return null;
  const fallback = buildFallbackBrief(payload, evidence);
  const prompt = {
    context: payload.context,
    required_output_shape: "Return JSON only with keys: mode, generatedAt, city, language, category, platform, objective, channel, score, sections[{title,body}], citations[{id,source_name,source_url,confidence}].",
    sections: [
      "1. Executive Summary — City × Language × Category opportunity snapshot with scores and evidence counts.",
      "2. Search Demand & Keyword Opportunity — What people search, keyword themes, content gaps.",
      "3. Competitive Intelligence — What competitors are doing, gaps to exploit, citing evidence IDs.",
      "4. Vernacular Content Strategy — Language-specific content recommendations, voice search, community tactics.",
      "5. Campaign Recommendations — 3-5 specific campaign concepts with channels, hooks, and rationale.",
      "6. Search Intent & Funnel Mapping — Top/Mid/Bottom/Post funnel actions with KPIs.",
      "7. Measurement & KPI Framework — Concrete metrics to track, targets to hit.",
      "8. Prioritized Action Plan — P0-P4 actions with owners and timelines."
    ],
    rules: [
      "Use only supplied evidence — every claim must cite evidence IDs in the body.",
      "Do not invent metrics, sources, screenshots, trend volume, app-review location, or campaign performance.",
      "If evidence is weak, say exactly what must be validated and how.",
      "Be specific about the city, language, and category — generate actionable campaign recommendations.",
      "Think like a professional SEO consultant for Indian vernacular markets."
    ],
    fallback_shape: fallback,
    evidence
  };

  const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_CONFIG.model,
      prompt: `You are a senior SEO consultant specializing in Indian vernacular markets and quick-commerce. Generate actionable, evidence-grounded briefs. Return compact valid JSON only.\n\n${JSON.stringify(prompt)}`,
      format: "json",
      stream: false
    })
  });
  if (!response.ok) throw new Error(`Ollama brief failed with ${response.status}: ${await response.text()}`);
  const data = await response.json();
  try {
    const parsed = JSON.parse(data.response || "{}");
    return { ...parsed, mode: parsed.mode || "backend_ollama" };
  } catch {
    return { ...fallback, mode: "backend_ollama_text", sections: [{ title: "Ollama brief", body: data.response || "" }], citations: fallback.citations };
  }
}

async function handleBrief(payload) {
  const context = payload.context || {};
  const city = String(context.city || "");
  const category = String(context.category || "");
  const language = String(context.language || "");
  const localEvidence = localEvidenceFromPayload(payload);
  const localCount = localEvidence.length;
  const cached = briefCache.get(city, category, language, { source: "backend", n: localCount });
  if (cached) return { ...cached, _cache: "hit" };

  const stored = await loadStoredEvidence();
  const cityLower = city.toLowerCase();
  const categoryLower = category.toLowerCase();

  const cityMatch = (stored.evidence || []).filter(item => {
    const blob = `${item.city} ${item.category} ${(item.tags || []).join(" ")} ${item.claim}`.toLowerCase();
    return cityLower && blob.includes(cityLower);
  });

  const relevantStored = cityMatch.length > 0
    ? cityMatch
    : (stored.evidence || []).filter(item => {
        const blob = `${item.category} ${(item.tags || []).join(" ")} ${item.claim}`.toLowerCase();
        return !categoryLower || blob.includes(categoryLower);
      });

  const evidence = [...localEvidence, ...relevantStored].slice(0, 40);
  const preferredProviders = SECURE_CONFIG.llmProvider === "openai" ? [openAiBrief, ollamaBrief] : [ollamaBrief, openAiBrief];
  for (const provider of preferredProviders) {
    try {
      const brief = await provider(payload, evidence);
      if (brief) {
        await briefCache.set(city, category, language, brief, { source: "backend", n: localCount });
        return { ...brief, _cache: "miss" };
      }
    } catch (error) {
      if (provider === preferredProviders.at(-1)) {
        const fallback = buildFallbackBrief(payload, evidence);
        await briefCache.set(city, category, language, fallback, { source: "backend", n: localCount });
        return { ...fallback, _cache: "miss", mode: "backend_ai_error" };
      }
    }
  }
  const fallback = buildFallbackBrief(payload, evidence);
  await briefCache.set(city, category, language, fallback, { source: "backend", n: localCount });
  return { ...fallback, _cache: "miss" };
}

function assistantResponse(text, context) {
  const cmd = String(text || "").toLowerCase().trim();
  const section = context?.activeSection || "dashboard";

  if (cmd.includes("dashboard") || cmd.includes("market"))
    return `You are in ${section}. This dashboard compares market signals, local campaign plans, geo sales, and video CTR ideas.`;
  if (cmd.includes("metric") || cmd.includes("ctr") || cmd.includes("cac") || cmd.includes("cvr"))
    return "CTR tracks click interest, CAC tracks acquisition cost, CVR tracks click-to-order conversion, revenue tracks sales value, and repeat rate tracks retention.";
  if (cmd.includes("brand"))
    return `Current brand is ${context?.selectedBrand || "not selected"}. You can say "Switch to Blinkit", "Switch to Zepto", or "Switch to Swiggy".`;
  if (cmd.includes("summary")) {
    const metrics = context?.visibleMetrics?.length ? context.visibleMetrics.slice(0, 3).join(". ") : "No visible metrics found in this section.";
    return `${section} summary: ${metrics}`;
  }
  return "I can help with page navigation, campaign metrics, brand switching, or general questions.";
}

function handleAssistant(payload) {
  const text = payload?.message || payload?.text || "";
  const context = payload?.pageContext || {};
  return {
    response: assistantResponse(text, context),
    mode: "backend_deterministic",
    timestamp: new Date().toISOString(),
  };
}

async function handleSignals(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let body = {};
  if (req.method === "POST") {
    body = await readBody(req);
  }
  const city = body.city || url.searchParams.get("city") || "";
  const category = body.category || url.searchParams.get("category") || "";
  const brand = body.brand || url.searchParams.get("brand") || "all";
  const signalType = body.signalType || url.searchParams.get("signalType") || "all";
  const confidence = body.confidence || url.searchParams.get("confidence") || "all";
  const limit = Number(body.limit || url.searchParams.get("limit") || 25);

  const marketSignals = await readJsonFile(
    path.join(DATA_DIR, "market_signals_2025_2026.json"),
    { signals: [] }
  );
  const evidence = await loadStoredEvidence();
  const allSignals = (marketSignals.signals || []).map(s => ({
    id: s.id,
    signal_type: s.event_type,
    headline: s.signal_summary,
    marketing_action: s.recommended_dashboard_action || "Review and validate before use in analysis.",
    urgency: s.confidence === "A" ? "Critical" : s.confidence === "B" ? "High" : s.confidence === "C" ? "Medium" : "Low",
    source: s.source_name,
    source_url: s.source_url,
    brand: s.brand,
    city: null,
    category: null,
    confidence: s.confidence,
    date_published: s.date_published,
    business_impact_score: s.business_impact_score,
    needs_validation: s.needs_validation
  }));

  const liveSignals = (evidence.evidence || []).filter(e => e.city).slice(-50).map(e => ({
    id: e.id,
    signal_type: e.source_type,
    headline: e.claim || e.evidence_text?.slice(0, 200) || "Live evidence",
    marketing_action: "New evidence captured by ingestion agent.",
    urgency: e.confidence === "A" ? "Critical" : e.confidence === "B" ? "High" : "Medium",
    source: e.source_name,
    source_url: e.source_url,
    brand: "Live",
    city: e.city,
    category: e.category,
    confidence: e.confidence,
    date_published: e.captured_at,
    business_impact_score: 50,
    needs_validation: e.needs_validation
  }));

  let combined = [...liveSignals, ...allSignals];

  if (city && city !== "all") {
    const cityLower = city.toLowerCase();
    combined = combined.filter(s => !s.city || s.city?.toLowerCase() === cityLower || s.headline?.toLowerCase().includes(cityLower) || s.brand?.toLowerCase().includes(cityLower));
  }
  if (category && category !== "all") {
    const catLower = category.toLowerCase();
    combined = combined.filter(s => !s.category || s.category?.toLowerCase() === catLower || s.headline?.toLowerCase().includes(catLower));
  }
  if (brand && brand !== "all") combined = combined.filter(s => s.brand?.toLowerCase().includes(brand.toLowerCase()));
  if (signalType && signalType !== "all") combined = combined.filter(s => s.signal_type === signalType);
  if (confidence && confidence !== "all") combined = combined.filter(s => s.confidence === confidence);

  combined.sort((a, b) => (b.business_impact_score || 0) - (a.business_impact_score || 0));

  const total = combined.length;
  const sliced = combined.slice(0, limit);

  return {
    signals: sliced,
    total,
    sources: {
      market_research: allSignals.length,
      live_ingestion: liveSignals.length
    },
    lastUpdated: new Date().toISOString()
  };
}

async function handleLiveResults() {
  const evidence = await loadStoredEvidence();
  const status = pipeline.getStatus();
  const deltas = status.lastScoreResult?.deltas || [];
  const briefs = status.lastBriefResult?.briefs || [];
  return {
    evidence: {
      count: (evidence.evidence || []).length,
      recent: (evidence.evidence || []).slice(-10).reverse()
    },
    deltas: deltas.slice(0, 50),
    briefs: briefs.slice(0, 10),
    lastIngestion: status.lastIngestionResult,
    lastScore: status.lastScoreResult,
    lastBrief: status.lastBriefResult,
    pipelineStatus: {
      isRunning: status.isRunning,
      agents: status.agents
    }
  };
}

async function router(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (!rateLimiter.rateLimitMiddleware(1)(req, res)) return;
  if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/rag/health" || url.pathname === "/healthz")) {
    const h = await getHealth();
    alerts.evaluate(getMetrics(), h);
    const code = h.status === "unhealthy" ? 503 : 200;
    return sendJson(res, code, h);
  }
  if (req.method === "GET" && url.pathname === "/readyz") {
    const r = await getReadiness();
    return sendJson(res, r.ready ? 200 : 503, r);
  }
  if (req.method === "GET" && url.pathname === "/metrics") {
    const accept = (req.headers["accept"] || "").includes("text/plain");
    if (accept) {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
      return res.end(getPrometheusMetrics());
    }
    return sendJson(res, 200, getMetrics());
  }
  if ((req.method === "GET" || req.method === "POST") && ["/api/rag/evidence", "/evidence"].includes(url.pathname)) {
    if (req.method === "POST") { // consume body even if unused
      let body = ""; req.on("data", c => body += c); await new Promise(r => req.on("end", r));
    }
    return sendJson(res, 200, await loadStoredEvidence());
  }
  if (req.method === "POST" && ["/api/rag/brief", "/brief"].includes(url.pathname)) {
    return sendJson(res, 200, await handleBrief(await readBody(req)));
  }
  if (req.method === "POST" && ["/api/rag/ingest", "/ingest"].includes(url.pathname)) {
    return sendJson(res, 200, await ingestEvidence(await readBody(req)));
  }
  if (req.method === "POST" && ["/api/assistant", "/assistant"].includes(url.pathname)) {
    return sendJson(res, 200, await handleAssistant(await readBody(req)));
  }
  // Live signals endpoint - returns filtered/normalized market signals for the live signals tab
  if ((req.method === "GET" || req.method === "POST") && ["/api/signals", "/signals"].includes(url.pathname)) {
    return sendJson(res, 200, await handleSignals(req));
  }
  // Live pipeline results endpoint - returns latest evidence + scores + briefs for dashboards
  if ((req.method === "GET" || req.method === "POST") && ["/api/live", "/live"].includes(url.pathname)) {
    return sendJson(res, 200, await handleLiveResults());
  }
  // Pipeline / multi-agent endpoints
  if (req.method === "GET" && url.pathname === "/pipeline") {
    return sendJson(res, 200, pipeline.getStatus());
  }
  if (req.method === "GET" && url.pathname === "/pipeline/log") {
    const { getLog } = await import("./agents/pipeline-store.js");
    return sendJson(res, 200, getLog(Number(url.searchParams.get("limit") || 50)));
  }
  if (req.method === "POST" && url.pathname === "/pipeline/run") {
    const body = await readBody(req);
    let result;
    if (body.agent === "all") result = await pipeline.runAllAgents();
    else if (body.agent) result = await pipeline.runAgent(body.agent);
    else result = await pipeline.runAllAgents();
    wsBroadcast({ type: "pipeline_run", agent: body.agent || "all", result });
    return sendJson(res, 200, result);
  }
  if (req.method === "GET" && url.pathname === "/alerts") {
    const includeAck = url.searchParams.get("includeAcknowledged") === "true";
    return sendJson(res, 200, alerts.getAlerts({ includeAcknowledged: includeAck, limit: 100 }));
  }
  if (req.method === "POST" && url.pathname === "/alerts/ack") {
    const body = await readBody(req);
    if (body.id === "all") alerts.acknowledgeAll();
    else alerts.acknowledge(body.id);
    return sendJson(res, 200, alerts.getAlerts());
  }
  if (req.method === "GET" && url.pathname === "/cache/brief") {
    return sendJson(res, 200, briefCache.getStats());
  }
  if (req.method === "POST" && url.pathname === "/cache/brief/clear") {
    return sendJson(res, 200, { cleared: briefCache.clear() });
  }
  if (req.method === "GET" && url.pathname === "/rate-limit") {
    return sendJson(res, 200, rateLimiter.getStats());
  }
  if (req.method === "GET" && url.pathname === "/metrics/history") {
    const windowMs = Number(url.searchParams.get("windowMs") || 3600_000);
    return sendJson(res, 200, { ...getMetricsHistory({ windowMs }), summary: getMetricsSummary(windowMs) });
  }
  if (req.method === "GET" && url.pathname === "/ws/stats") {
    return sendJson(res, 200, getWsStats());
  }

  // ==========================================================================
  // CAMPAIGN FACTORY — 5-agent chain, real LLM calls (Groq + Mistral)
  // ==========================================================================
  if (req.method === "GET" && url.pathname === "/api/llm/status") {
    const providers = getLLMProviderStatus();
    const order = (process.env.LLM_PROVIDER_ORDER || "groq,mistral,ollama").split(",").map(s => s.trim()).filter(Boolean);
    const anyAvailable = providers.some(p => p.available);
    const setupHint = anyAvailable
      ? null
      : "Add GROQ_API_KEY or MISTRAL_API_KEY to backend/.env.local and restart. Get free keys at https://console.groq.com and https://console.mistral.ai";
    return sendJson(res, 200, { providers, order, anyAvailable, setupHint });
  }

  if (req.method === "POST" && url.pathname === "/api/brief/generate") {
    const body = await readBody(req);
    const { city, category, language, brand, persona } = body;
    const p = persona || { name: "Target customer", preferredLanguage: language, willingnessToPay: 300, preferredChannels: ["WhatsApp", "Instagram"] };
    const result = await copyAgent.run({ persona: p, city: city || "Hyderabad", category: category || "Grocery", language: language || "Hindi", brand: brand || "blinkit", objective: body.objective || "First order", variantCount: body.variantCount || 5 });
    return sendJson(res, 200, result);
  }

  if (req.method === "POST" && url.pathname === "/api/agent/research") {
    const body = await readBody(req);
    const result = await researchAgent.run({ brand: body.brand || "blinkit", city: body.city || "" });
    return sendJson(res, 200, result);
  }
  if (req.method === "POST" && url.pathname === "/api/agent/audience") {
    const body = await readBody(req);
    const result = await audienceAgent.run({
      city: body.city || "Hyderabad", category: body.category || "Grocery",
      language: body.language || "Hindi", brand: body.brand || "blinkit"
    });
    return sendJson(res, 200, result);
  }
  if (req.method === "POST" && url.pathname === "/api/agent/copy") {
    const body = await readBody(req);
    const result = await copyAgent.run({
      persona: body.persona, city: body.city, category: body.category,
      language: body.language, brand: body.brand, objective: body.objective, variantCount: body.variantCount
    });
    return sendJson(res, 200, result);
  }
  if (req.method === "POST" && url.pathname === "/api/agent/channel") {
    const body = await readBody(req);
    const result = await channelAgent.run({
      persona: body.persona, variants: body.variants || [],
      city: body.city, category: body.category, language: body.language,
      brand: body.brand, budget: body.budget || 50000
    });
    return sendJson(res, 200, result);
  }
  if (req.method === "POST" && url.pathname === "/api/agent/compliance") {
    const body = await readBody(req);
    const result = await complianceAgent.run({ variants: body.variants || [], category: body.category, brand: body.brand });
    return sendJson(res, 200, result);
  }

  if (req.method === "GET" && url.pathname === "/api/research/latest") {
    return sendJson(res, 200, { summaries: getAllResearchSummaries() });
  }
  if (req.method === "POST" && url.pathname === "/api/research/refresh") {
    const body = await readBody(req);
    const brand = body.brand || "blinkit";
    const result = await researchAgent.run({ brand, city: body.city || "" });
    return sendJson(res, 200, result);
  }

  if (req.method === "POST" && url.pathname === "/api/campaign/run") {
    const body = await readBody(req);
    const result = await runCampaignChain(body);
    return sendJson(res, 200, result);
  }
  if (req.method === "GET" && url.pathname === "/api/campaign/active") {
    return sendJson(res, 200, { active: getActiveCampaignRuns() });
  }
  if (req.method === "GET" && url.pathname === "/api/campaign/history") {
    return sendJson(res, 200, { history: getCampaignHistory(50), defaults: CAMPAIGN_DEFAULTS });
  }

  if (req.method === "GET" && url.pathname === "/api/campaign/events/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
      "X-Accel-Buffering": "no"
    });
    res.write(": connected\n\n");
    const unsubscribe = subscribeBus((event) => {
      try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch {}
    });
    const heartbeat = setInterval(() => { try { res.write(`: ping\n\n`); } catch {} }, 15000);
    req.on("close", () => { clearInterval(heartbeat); unsubscribe(); try { res.end(); } catch {} });
    return;
  }

  return sendJson(res, 404, { error: "Not found", path: url.pathname });
}

const httpServer = createServer((req, res) => {
  const t0 = Date.now();
  const url = new URL(req.url, `http://${req.headers.host}`);
  let recorded = false;
  const onFinish = () => {
    if (recorded) return;
    recorded = true;
    const duration = Date.now() - t0;
    const path = url.pathname.length > 50 ? url.pathname.slice(0, 50) + "..." : url.pathname;
    const status = res.statusCode || 200;
    const tag = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
    console.log(`[${new Date().toISOString()}] ${tag} ${req.method} ${path} ${status} ${duration}ms`);
    try { recordRequest(req.method, path, status, duration); } catch {}
  };
  res.on("finish", onFinish);
  res.on("close", onFinish);
  router(req, res).catch(error => {
    if (!res.headersSent) sendJson(res, 500, { error: error.message, providers: PROVIDERS });
    else res.end();
  });
});

const wss = new WebSocketServer({ noServer: true });
httpServer.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wsHandleClient(ws);
    });
  } else {
    socket.destroy();
  }
});

httpServer.listen(PORT, "127.0.0.1", () => {
  const evidenceState = existsSync(EVIDENCE_FILE) ? "existing evidence store loaded" : "evidence store will be created on first ingest";
  console.log(`Bharat RAG backend running at http://127.0.0.1:${PORT}/api/rag (${evidenceState})`);
  console.log(`Observability: GET /healthz | /readyz | /metrics | /metrics/history | /alerts`);
  console.log(`Rate limit: ${rateLimiter.getStats().perIp.capacity} req/IP, ${rateLimiter.getStats().global.capacity} req/global`);
  console.log(`WebSocket: ws://127.0.0.1:${PORT}/ws (push every 3s)`);
  pipeline.startOrchestrator();
  startWsBroadcaster();
  startMetricsHistory();
  console.log("Multi-agent pipeline started (ingestion every 3h, score after ingestion, brief on demand)");
  console.log("Brief cache, alerts, rate limiting, metrics history, WebSocket all active");

  process.on("SIGTERM", () => { shutdownOrchestrator(); stopWsBroadcaster(); stopMetricsHistory(); });
  process.on("SIGINT", () => { shutdownOrchestrator(); stopWsBroadcaster(); stopMetricsHistory(); process.exit(0); });
});
