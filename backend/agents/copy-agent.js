import { emit } from "./event-bus.js";
import { llm } from "../llm.js";

const VARIANT_CACHE = new Map();

const SYSTEM_PROMPT = `You are a senior Indian copywriter specializing in regional-language performance marketing for quick commerce. You write in Hinglish, Tanglish, or pure vernacular when the audience is vernacular. You never use marketing-speak. You write like a real person who shops in this city.

Hard rules:
- Every variant MUST be tailored to the persona's pain point or trigger — no generic copy.
- Use the persona's preferred language for the primary message; add a short Hinglish/English alt.
- Each variant must include a strong CTA, a price hook (₹X off / free delivery / 10-min promise).
- Localize the city reference — use landmark or neighborhood references, not just city name.
- Do NOT invent product specs, MRP, or stock data — only copy.
- Return ONLY valid JSON. No prose, no markdown fences.`;

async function generateCopyVariants({ persona, city, category, language, brand, objective, count = 5 }) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Generate ${count} distinct ad copy variants for:
- Brand: ${brand}
- City: ${city}
- Category: ${category}
- Primary language: ${language}
- Objective: ${objective || "First order conversion"}

PERSONA (use this — don't generalize):
${JSON.stringify(persona, null, 2)}

Return JSON:
{
  "variants": [
    {
      "id": "v1",
      "channel": "whatsapp" | "instagram_reel" | "google_search" | "display_banner" | "push_notification" | "youtube_short",
      "hook": "first 6 words that stop the scroll",
      "body": "full message in primary language with Hinglish where natural, 1-3 sentences max",
      "cta": "action verb + urgency (e.g. 'Order in 10 min — use code FIRST50')",
      "translation_en": "English translation of body for review",
      "tone": "urgent" | "playful" | "trustworthy" | "aspirational" | "community",
      "estimatedCtrBand": "low" | "medium" | "high",
      "rationale": "1 sentence tying this variant to a specific persona pain point"
    }
  ]
}`
    }
  ];
  const result = await llm.json(messages, { maxTokens: 2400, temperature: 0.85 });
  if (!result.success) return { variants: [], error: result.errors?.[0]?.error || "no provider" };
  return { variants: result.parsed.variants || [], provider: result.provider, model: result.model, durationMs: result.durationMs };
}

async function generateContentBrief({ persona, city, category, language, brand }) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Write a real, ready-to-publish content brief for:
- Brand: ${brand}
- City: ${city}
- Category: ${category}
- Language: ${language}

PERSONA (anchor everything to this):
${JSON.stringify(persona, null, 2)}

Return JSON:
{
  "title": "catchy campaign title in primary language + English",
  "concept": "2-3 sentences on the core creative concept",
  "keyMessage": "the one sentence we want stuck in the consumer's head",
  "tagline": "campaign tagline in primary language",
  "taglineAlt": "English fallback",
  "deliverables": [
    {"type": "3-sec reel script", "spec": "vertical 9:16, fast cuts, 3 hook beats", "outline": "Scene 1: ..., Scene 2: ..., Scene 3: ..."}
  ],
  "tone": "describe tone in 3 words",
  "doList": ["specific creative must-do", "..."],
  "dontList": ["specific creative must-avoid", "..."]
}`
    }
  ];
  const result = await llm.json(messages, { maxTokens: 2200, temperature: 0.7 });
  if (!result.success) return null;
  return { ...result.parsed, provider: result.provider, model: result.model, durationMs: result.durationMs };
}

export async function runCopyAgent({ persona, city, category, language, brand, objective, variantCount = 5 }) {
  const id = `copy-${Date.now()}`;
  emit({ type: "agent_start", agent: "copy", runId: id, brand, city });
  const t0 = Date.now();
  try {
    emit({ type: "agent_progress", agent: "copy", runId: id, stage: "variants", target: variantCount });
    const { variants, provider, model, durationMs, error } = await generateCopyVariants({ persona, city, category, language, brand, objective, count: variantCount });
    if (error) emit({ type: "agent_warn", agent: "copy", runId: id, message: `Variants fell back: ${error}` });
    emit({ type: "agent_progress", agent: "copy", runId: id, stage: "brief" });
    const brief = await generateContentBrief({ persona, city, category, language, brand });
    const result = {
      runId: id,
      brand,
      city,
      category,
      language,
      objective,
      variants,
      brief,
      variantCount: variants.length,
      provider,
      model,
      durationMs: Date.now() - t0,
      llmDurationMs: durationMs,
      timestamp: new Date().toISOString()
    };
    emit({ type: "agent_complete", agent: "copy", runId: id, result, durationMs: result.durationMs });
    return result;
  } catch (e) {
    emit({ type: "agent_error", agent: "copy", runId: id, error: e.message });
    throw e;
  }
}

export const copyAgent = { run: runCopyAgent };
export default copyAgent;
