import { emit, subscribe } from "./event-bus.js";
import researchAgent from "./research-agent.js";
import audienceAgent from "./audience-agent.js";
import copyAgent from "./copy-agent.js";
import channelAgent from "./channel-agent.js";
import complianceAgent from "./compliance-agent.js";

const RUN_HISTORY = [];
const ACTIVE_RUNS = new Map();
const MAX_HISTORY = 100;

const DEFAULT_INPUT = {
  brand: "blinkit",
  city: "Hyderabad",
  category: "Grocery",
  language: "Telugu",
  objective: "First order conversion",
  budget: 50000,
  variantCount: 5
};

async function runCampaignChain(input = {}) {
  const params = { ...DEFAULT_INPUT, ...input };
  const chainId = `chain-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const t0 = Date.now();
  const stages = [];

  const ctx = {
    chainId,
    startedAt: new Date().toISOString(),
    input: params,
    stages,
    events: []
  };
  ACTIVE_RUNS.set(chainId, ctx);

  const stageStart = (name, label) => {
    const stage = { name, label, startedAt: Date.now(), status: "running" };
    stages.push(stage);
    ctx.currentStage = name;
    emit({ type: "chain_stage_start", chainId, stage: name, label, totalStages: 5, stageIndex: stages.length - 1 });
    return stage;
  };
  const stageEnd = (name, result, error) => {
    const stage = stages.find(s => s.name === name);
    if (stage) {
      stage.endedAt = Date.now();
      stage.durationMs = stage.endedAt - stage.startedAt;
      stage.status = error ? "error" : "complete";
      if (result) stage.summary = summarizeStage(name, result);
      if (error) stage.error = error.message;
    }
    emit({ type: "chain_stage_end", chainId, stage: name, status: stage?.status, durationMs: stage?.durationMs, error: error?.message });
  };

  const eventSub = subscribe((e) => {
    if (e.chainId) return;
    if (e.type?.startsWith("agent_")) {
      ctx.events.push({ ...e, receivedAt: Date.now() });
      while (ctx.events.length > 500) ctx.events.shift();
      emit({ type: "chain_event", chainId, event: e });
    }
  });

  emit({ type: "chain_start", chainId, input: params, totalStages: 5 });

  try {
    // Stage 1: Research
    stageStart("research", "🔍 Research Agent — Live market intelligence");
    const researchResult = await researchAgent.run({ brand: params.brand, city: params.city });
    ctx.research = researchResult;
    stageEnd("research", researchResult);

    // Stage 2: Audience
    stageStart("audience", "👥 Audience Agent — Persona generation");
    const audienceResult = await audienceAgent.run({
      city: params.city, category: params.category, language: params.language, brand: params.brand
    });
    ctx.audience = audienceResult;
    stageEnd("audience", audienceResult);

    // Stage 3: Copy
    stageStart("copy", "✍️ Copy Agent — Variants + content brief");
    const copyResult = await copyAgent.run({
      persona: audienceResult.persona, city: params.city, category: params.category,
      language: params.language, brand: params.brand, objective: params.objective, variantCount: params.variantCount
    });
    ctx.copy = copyResult;
    stageEnd("copy", copyResult);

    // Stage 4: Channel
    stageStart("channel", "📡 Channel Agent — Media plan + performance prediction");
    const channelResult = await channelAgent.run({
      persona: audienceResult.persona, variants: copyResult.variants,
      city: params.city, category: params.category, language: params.language,
      brand: params.brand, budget: params.budget
    });
    ctx.channel = channelResult;
    stageEnd("channel", channelResult);

    // Stage 5: Compliance
    stageStart("compliance", "⚖️ Compliance Agent — ASCI/FSSAI audit");
    const complianceResult = await complianceAgent.run({
      variants: copyResult.variants, category: params.category, brand: params.brand
    });
    ctx.compliance = complianceResult;
    stageEnd("compliance", complianceResult);

    ctx.endedAt = new Date().toISOString();
    ctx.totalDurationMs = Date.now() - t0;
    ctx.status = "complete";
    ctx.overallScore = computeOverallScore(ctx);

    const finalPackage = packageCampaign(ctx);
    emit({ type: "chain_complete", chainId, package: finalPackage, totalDurationMs: ctx.totalDurationMs });

    RUN_HISTORY.unshift({ chainId, startedAt: ctx.startedAt, endedAt: ctx.endedAt, input: params, status: ctx.status, totalDurationMs: ctx.totalDurationMs, overallScore: ctx.overallScore });
    if (RUN_HISTORY.length > MAX_HISTORY) RUN_HISTORY.pop();
    return finalPackage;
  } catch (e) {
    ctx.status = "error";
    ctx.error = e.message;
    ctx.endedAt = new Date().toISOString();
    ctx.totalDurationMs = Date.now() - t0;
    emit({ type: "chain_error", chainId, error: e.message });
    throw e;
  } finally {
    eventSub();
    ACTIVE_RUNS.delete(chainId);
  }
}

function summarizeStage(name, result) {
  switch (name) {
    case "research": return { sources: result.sources, summary: result.summary?.summary?.slice(0, 140) };
    case "audience": return { persona: result.persona?.name, age: result.persona?.age, lang: result.persona?.preferredLanguage };
    case "copy": return { variants: result.variantCount, briefTitle: result.brief?.title, provider: result.provider };
    case "channel": return { predictedOrders: result.performance?.predicted?.orders, roas: result.performance?.predicted?.roas, channels: result.performance?.channelPlan?.length };
    case "compliance": return { verdict: result.overallVerdict, riskScore: result.riskScore, findings: (result.patternFindings?.length || 0) + (result.llmAudit?.findings?.length || 0) };
    default: return null;
  }
}

function computeOverallScore(ctx) {
  let score = 50;
  if (ctx.copy?.variants?.length >= 5) score += 15;
  if (ctx.copy?.brief) score += 10;
  if (ctx.research?.sources > 5) score += 10;
  if (ctx.audience?.persona?.llmProvider) score += 5;
  if (ctx.channel?.performance?.predicted?.orders > 50) score += 10;
  if (ctx.compliance?.overallVerdict === "pass") score += 10;
  else if (ctx.compliance?.overallVerdict === "block") score -= 20;
  return Math.max(0, Math.min(100, score));
}

function packageCampaign(ctx) {
  return {
    chainId: ctx.chainId,
    status: ctx.status,
    startedAt: ctx.startedAt,
    endedAt: ctx.endedAt,
    totalDurationMs: ctx.totalDurationMs,
    overallScore: ctx.overallScore,
    input: ctx.input,
    research: ctx.research && {
      brand: ctx.research.brand,
      city: ctx.research.city,
      sources: ctx.research.sources,
      summary: ctx.research.summary,
      durationMs: ctx.research.durationMs
    },
    audience: ctx.audience && {
      persona: ctx.audience.persona,
      demographics: ctx.audience.demographics,
      durationMs: ctx.audience.durationMs
    },
    copy: ctx.copy && {
      variants: ctx.copy.variants,
      brief: ctx.copy.brief,
      provider: ctx.copy.provider,
      model: ctx.copy.model,
      variantCount: ctx.copy.variantCount,
      durationMs: ctx.copy.durationMs
    },
    channel: ctx.channel && {
      performance: ctx.channel.performance,
      plan: ctx.channel.plan,
      durationMs: ctx.channel.durationMs
    },
    compliance: ctx.compliance && {
      overallVerdict: ctx.compliance.overallVerdict,
      riskScore: ctx.compliance.riskScore,
      patternFindings: ctx.compliance.patternFindings,
      llmAudit: ctx.compliance.llmAudit,
      requiredDisclaimers: ctx.compliance.requiredDisclaimers,
      durationMs: ctx.compliance.durationMs
    },
    stageTimeline: ctx.stages.map(s => ({ name: s.name, label: s.label, status: s.status, durationMs: s.durationMs, summary: s.summary }))
  };
}

function getActiveRuns() { return [...ACTIVE_RUNS.values()]; }
function getHistory(limit = 20) { return RUN_HISTORY.slice(0, limit); }

function shutdown() {
  for (const [id, ctx] of ACTIVE_RUNS) {
    ctx.status = "cancelled";
    ctx.endedAt = new Date().toISOString();
    ctx.error = "Server shutdown";
  }
  ACTIVE_RUNS.clear();
}

export { runCampaignChain, getActiveRuns, getHistory, shutdown, DEFAULT_INPUT };
export default { run: runCampaignChain, active: getActiveRuns, history: getHistory, shutdown };
