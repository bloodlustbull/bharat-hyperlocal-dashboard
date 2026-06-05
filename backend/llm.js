import Groq from "groq-sdk";
import { Mistral } from "@mistralai/mistralai";

const PROVIDERS = {
  groq: {
    name: "groq",
    models: {
      fast: process.env.GROQ_MODEL_FAST || "llama-3.1-8b-instant",
      default: process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
    }
  },
  mistral: {
    name: "mistral",
    models: {
      fast: process.env.MISTRAL_MODEL_FAST || "mistral-small-latest",
      default: process.env.MISTRAL_MODEL || "mistral-large-latest"
    }
  }
};

function providerOrder() {
  const order = (process.env.LLM_PROVIDER_ORDER || "groq,mistral,ollama")
    .split(",").map(s => s.trim()).filter(Boolean);
  return order;
}

function getProvider(name) {
  if (name === "groq" && process.env.GROQ_API_KEY) {
    return { type: "groq", client: new Groq({ apiKey: process.env.GROQ_API_KEY }) };
  }
  if (name === "mistral" && process.env.MISTRAL_API_KEY) {
    return { type: "mistral", client: new Mistral({ apiKey: process.env.MISTRAL_API_KEY }) };
  }
  if (name === "ollama" && process.env.OLLAMA_ENABLED === "true") {
    return { type: "ollama", baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434" };
  }
  return null;
}

function providerMissingReason(name) {
  if (name === "groq") return process.env.GROQ_API_KEY ? null : "GROQ_API_KEY not set in environment";
  if (name === "mistral") return process.env.MISTRAL_API_KEY ? null : "MISTRAL_API_KEY not set in environment";
  if (name === "ollama") return process.env.OLLAMA_ENABLED === "true" ? null : "OLLAMA_ENABLED !== 'true' (set it to enable local Ollama fallback)";
  return `Unknown provider "${name}"`;
}

async function callGroq(client, model, messages, opts) {
  const completion = await client.chat.completions.create({
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
    response_format: opts.jsonMode ? { type: "json_object" } : undefined
  });
  return completion.choices?.[0]?.message?.content || "";
}

async function callMistral(client, model, messages, opts) {
  const completion = await client.chat.complete({
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: opts.temperature ?? 0.7,
    maxTokens: opts.maxTokens ?? 2048,
    responseFormat: opts.jsonMode ? { type: "json_object" } : undefined
  });
  return completion.choices?.[0]?.message?.content || "";
}

async function callOllama(baseUrl, model, messages, opts) {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: opts.jsonMode ? "json" : undefined,
      options: { temperature: opts.temperature ?? 0.7, num_predict: opts.maxTokens ?? 2048 }
    })
  });
  if (!res.ok) throw new Error(`Ollama failed: ${res.status}`);
  const data = await res.json();
  return data.message?.content || "";
}

async function callProvider(providerName, modelTier, messages, opts = {}) {
  const p = getProvider(providerName);
  if (!p) throw new Error(`Provider ${providerName} not configured`);
  const model = PROVIDERS[providerName]?.models[modelTier] || PROVIDERS[providerName]?.models.default;
  if (!model) throw new Error(`No model for ${providerName}`);
  const t0 = Date.now();
  let content = "";
  if (p.type === "groq") content = await callGroq(p.client, model, messages, opts);
  else if (p.type === "mistral") content = await callMistral(p.client, model, messages, opts);
  else if (p.type === "ollama") content = await callOllama(p.baseUrl, model, messages, opts);
  return { content, provider: providerName, model, durationMs: Date.now() - t0 };
}

export async function llmComplete(messages, opts = {}) {
  const order = providerOrder();
  const tier = opts.fast ? "fast" : "default";
  const errors = [];
  for (const name of order) {
    const p = getProvider(name);
    if (!p) continue;
    try {
      const result = await callProvider(name, tier, messages, opts);
      return { ...result, success: true, attempted: order, errors };
    } catch (e) {
      errors.push({ provider: name, error: e.message });
    }
  }
  return { content: "", success: false, attempted: order, errors };
}

function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  const fenceMatch = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
  if (fenceMatch) t = fenceMatch[1].trim();
  try { return JSON.parse(t); } catch {}
  const firstBrace = t.indexOf("{");
  const lastBrace = t.lastIndexOf("}");
  const firstBracket = t.indexOf("[");
  const lastBracket = t.lastIndexOf("]");
  const candidates = [];
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) candidates.push(t.slice(firstBrace, lastBrace + 1));
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) candidates.push(t.slice(firstBracket, lastBracket + 1));
  for (const c of candidates) {
    try { return JSON.parse(c); } catch {}
  }
  return null;
}

export async function llmJson(messages, opts = {}) {
  const errors = [];
  const result = await llmComplete(messages, { ...opts, jsonMode: true });
  if (!result.success) return { ...result, parsed: null, errors: [...errors, ...(result.errors || [])] };
  let parsed = extractJson(result.content);
  if (parsed !== null) {
    return { ...result, parsed, parseRetries: 0, errors: [...errors, ...(result.errors || [])] };
  }
  errors.push({ provider: result.provider, error: "Initial JSON parse failed, retrying with stricter prompt" });
  const strictMessages = [
    ...messages,
    {
      role: "user",
      content: "Your previous response was not valid JSON. Respond with ONLY valid JSON and nothing else — no prose, no markdown fences, no explanation. Just the JSON object."
    }
  ];
  const retry = await llmComplete(strictMessages, { ...opts, jsonMode: true, temperature: 0.2 });
  if (!retry.success) {
    return { ...result, parsed: null, parseRetries: 1, errors: [...errors, ...(retry.errors || [])] };
  }
  parsed = extractJson(retry.content);
  if (parsed !== null) {
    return { ...retry, parsed, parseRetries: 1, errors: [...errors, ...(retry.errors || [])] };
  }
  errors.push({ provider: retry.provider, error: "Retry JSON parse also failed" });
  return { ...retry, parsed: null, parseRetries: 1, errors: [...errors, ...(retry.errors || [])] };
}

export function getLLMProviderStatus() {
  return providerOrder().map(name => {
    const p = getProvider(name);
    const model = PROVIDERS[name]?.models?.default || null;
    return { name, model, available: !!p, type: p?.type || null, reason: p ? null : providerMissingReason(name) };
  });
}

export const llm = { complete: llmComplete, json: llmJson, status: getLLMProviderStatus, extractJson };
export { extractJson };
export default llm;
