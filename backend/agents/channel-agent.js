import { emit } from "./event-bus.js";
import { llm } from "../llm.js";

const CHANNEL_BENCHMARKS = {
  whatsapp: { ctr: 0.18, cpa: 22, cpm: 8, format: "broadcast + catalog carousel" },
  instagram_reel: { ctr: 0.022, cpa: 95, cpm: 45, format: "9:16 vertical 6-15s" },
  google_search: { ctr: 0.045, cpa: 140, cpm: 110, format: "RSA + sitelinks + callout" },
  display_banner: { ctr: 0.004, cpa: 280, cpm: 25, format: "responsive display 1200x628" },
  push_notification: { ctr: 0.08, cpa: 18, cpm: 4, format: "rich push with image" },
  youtube_short: { ctr: 0.015, cpa: 130, cpm: 35, format: "vertical <60s" },
  influencer_post: { ctr: 0.03, cpa: 180, cpm: 60, format: "regional micro-creator" }
};

function channelFor(variantChannel) {
  return CHANNEL_BENCHMARKS[variantChannel] || CHANNEL_BENCHMARKS.whatsapp;
}

function predictPerformance({ variants, persona, city, category, budget = 50000 }) {
  if (!variants.length) {
    return { predicted: { orders: 0, revenue: 0, cpa: 0, ctr: 0, roas: 0 }, channelPlan: [] };
  }
  const channelMix = {};
  for (const v of variants) {
    const ch = v.channel || "whatsapp";
    if (!channelMix[ch]) channelMix[ch] = { count: 0, estCtr: 0, estCpa: 0 };
    const bench = channelFor(ch);
    channelMix[ch].count += 1;
    channelMix[ch].estCtr = bench.ctr;
    channelMix[ch].estCpa = bench.cpa;
  }
  const totalShare = 1;
  let totalOrders = 0;
  let totalSpend = 0;
  const channelPlan = [];
  for (const [ch, m] of Object.entries(channelMix)) {
    const share = m.count / variants.length;
    const spend = budget * share;
    const impressions = spend / (channelFor(ch).cpm / 1000);
    const clicks = impressions * m.estCtr;
    const orders = Math.round(clicks * 0.04);
    const revenue = orders * (persona?.willingnessToPay || 300);
    totalOrders += orders;
    totalSpend += spend;
    channelPlan.push({
      channel: ch,
      format: channelFor(ch).format,
      variants: m.count,
      share: Math.round(share * 100),
      spend: Math.round(spend),
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      orders,
      revenue: Math.round(revenue),
      benchmarkCtr: m.estCtr,
      benchmarkCpa: m.estCpa
    });
  }
  const totalRevenue = channelPlan.reduce((s, c) => s + c.revenue, 0);
  return {
    predicted: {
      orders: totalOrders,
      revenue: totalRevenue,
      spend: Math.round(totalSpend),
      cpa: totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0,
      ctr: variants.length ? (Object.values(channelMix).reduce((s, m) => s + m.estCtr, 0) / variants.length) : 0,
      roas: totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : 0
    },
    channelPlan
  };
}

async function generateChannelPlan({ persona, city, category, language, brand, variants, budget = 50000 }) {
  const variantSummary = variants.slice(0, 5).map(v => `${v.channel}: ${v.hook || v.body?.slice(0, 60) || "variant"}`).join("\n");
  const messages = [
    {
      role: "system",
      content: "You are a senior media planner for Indian quick commerce. Return ONLY valid JSON with: {weeklyPlan: [{day, channel, action, budget, expectedOutcome}], budgetAllocation: {channel: pct}, kpis: [{name, target, rationale}], complianceNotes: [string]}. Be specific to the city and brand. No prose."
    },
    {
      role: "user",
      content: `Plan a 7-day, ₹${budget} budget campaign for:
- Brand: ${brand}, City: ${city}, Category: ${category}, Language: ${language}
- Total budget: ₹${budget}
- Willingness to pay: ₹${persona?.willingnessToPay || 300}
- Persona: ${persona?.name || "N/A"}, ${persona?.occupation || ""}, prefers ${persona?.preferredChannels?.join(", ") || "WhatsApp"}

Variants to deploy:
${variantSummary}

Constraints: compliance with ASCI India, no comparative superlatives ("best", "#1") without disclosure, no claims about medical/health benefits.`
    }
  ];
  const result = await llm.json(messages, { maxTokens: 1800, temperature: 0.5 });
  if (!result.success) return null;
  return result.parsed;
}

export async function runChannelAgent({ persona, variants, city, category, language, brand, budget = 50000 }) {
  const id = `channel-${Date.now()}`;
  emit({ type: "agent_start", agent: "channel", runId: id, brand, city, budget });
  const t0 = Date.now();
  try {
    emit({ type: "agent_progress", agent: "channel", runId: id, stage: "performance_prediction" });
    const performance = predictPerformance({ variants, persona, city, category, budget });
    emit({ type: "agent_progress", agent: "channel", runId: id, stage: "media_plan" });
    const plan = await generateChannelPlan({ persona, city, category, language, brand, variants, budget });
    const result = {
      runId: id,
      brand,
      city,
      category,
      language,
      budget,
      performance,
      plan,
      durationMs: Date.now() - t0,
      timestamp: new Date().toISOString()
    };
    emit({ type: "agent_complete", agent: "channel", runId: id, result, durationMs: result.durationMs });
    return result;
  } catch (e) {
    emit({ type: "agent_error", agent: "channel", runId: id, error: e.message });
    throw e;
  }
}

export const channelAgent = { run: runChannelAgent, predictPerformance, channelFor, CHANNEL_BENCHMARKS };
export { CHANNEL_BENCHMARKS, predictPerformance, channelFor };
export default channelAgent;
