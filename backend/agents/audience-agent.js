import { emit } from "./event-bus.js";
import { llm } from "../llm.js";

const PERSONA_CACHE = new Map();

const CITY_DEMOGRAPHICS = {
  Hyderabad: { tier: "tier-1", languages: ["Telugu", "Hindi", "English"], avgAOV: 350, smartphonePct: 78, workingWomenPct: 28, medianAge: 29 },
  Mumbai: { tier: "tier-1", languages: ["Hindi", "Marathi", "English"], avgAOV: 420, smartphonePct: 82, workingWomenPct: 32, medianAge: 31 },
  Delhi: { tier: "tier-1", languages: ["Hindi", "English", "Punjabi"], avgAOV: 400, smartphonePct: 80, workingWomenPct: 30, medianAge: 30 },
  Bangalore: { tier: "tier-1", languages: ["Kannada", "English", "Hindi"], avgAOV: 450, smartphonePct: 88, workingWomenPct: 35, medianAge: 30 },
  Chennai: { tier: "tier-1", languages: ["Tamil", "English"], avgAOV: 380, smartphonePct: 75, workingWomenPct: 26, medianAge: 32 },
  Pune: { tier: "tier-1", languages: ["Marathi", "Hindi", "English"], avgAOV: 390, smartphonePct: 80, workingWomenPct: 29, medianAge: 30 },
  Kochi: { tier: "tier-2", languages: ["Malayalam", "English"], avgAOV: 320, smartphonePct: 76, workingWomenPct: 25, medianAge: 33 },
  Bhubaneswar: { tier: "tier-2", languages: ["Odia", "Hindi"], avgAOV: 280, smartphonePct: 68, workingWomenPct: 22, medianAge: 31 },
  Mysuru: { tier: "tier-2", languages: ["Kannada", "English"], avgAOV: 300, smartphonePct: 70, workingWomenPct: 23, medianAge: 32 },
  Nagpur: { tier: "tier-2", languages: ["Marathi", "Hindi"], avgAOV: 290, smartphonePct: 65, workingWomenPct: 20, medianAge: 30 },
  Ludhiana: { tier: "tier-2", languages: ["Punjabi", "Hindi"], avgAOV: 310, smartphonePct: 72, workingWomenPct: 24, medianAge: 31 }
};

function getDemographics(city) {
  return CITY_DEMOGRAPHICS[city] || { tier: "tier-2", languages: ["Hindi", "English"], avgAOV: 300, smartphonePct: 70, workingWomenPct: 24, medianAge: 30 };
}

async function generatePersona({ city, category, language, brand }) {
  const cacheKey = `${city}-${category}-${language}-${brand}`;
  if (PERSONA_CACHE.has(cacheKey)) return PERSONA_CACHE.get(cacheKey);
  const demo = getDemographics(city);
  const messages = [
    {
      role: "system",
      content: "You are a senior consumer insights analyst for Indian quick commerce. Return ONLY valid JSON: {name (Indian name), age, occupation, dailyRoutine (3 bullets), shoppingBehavior (3 bullets), painPoints (array of 3 specific pain points for this city+category), preferredChannels (array of 3 channels with rationale), motivationalTriggers (array of 3), preferredLanguage, secondaryLanguages, willingnessToPay (number, INR for one order), frequencyPerWeek (number), peakShoppingHours (array of 2), keyQuote (1 sentence in their voice — the language specified)}. Be hyper-specific to the city and category."
    },
    {
      role: "user",
      content: `City: ${city}\nCategory: ${category}\nPrimary language: ${language}\nBrand being marketed: ${brand}\n\nDemographics: tier=${demo.tier}, avgAOV=₹${demo.avgAOV}, smartphone=${demo.smartphonePct}%, workingWomen=${demo.workingWomenPct}%, medianAge=${demo.medianAge}\n\nGenerate one vivid, hyper-specific persona.`
    }
  ];
  const result = await llm.json(messages, { maxTokens: 1400, temperature: 0.7 });
  if (!result.success || !result.parsed) {
    return {
      name: "Anita Sharma",
      age: 30,
      occupation: "Working professional",
      dailyRoutine: ["Commute 9-10am", "Lunch break around 1pm", "Evening errands 6-8pm"],
      shoppingBehavior: ["Quick top-up orders", "Compares prices on app", "Reads reviews"],
      painPoints: ["Out of stock on essentials", "Late delivery slots", "Surge pricing"],
      preferredChannels: ["WhatsApp", "Instagram Reels", "Google Search"],
      motivationalTriggers: ["Discount on first order", "Free delivery above ₹199", "10-min promise"],
      preferredLanguage: language,
      secondaryLanguages: demo.languages.filter(l => l !== language).slice(0, 2),
      willingnessToPay: demo.avgAOV,
      frequencyPerWeek: 4,
      peakShoppingHours: ["13:00", "19:30"],
      keyQuote: language === "Hindi" ? `${city} mein jaldi chahiye, ${brand} pe sab kuch milta hai.` : `I want everything fast in ${city}, ${brand} delivers.`,
      llmProvider: result.provider || null,
      llmFallback: !result.success
    };
  }
  const persona = { ...result.parsed, llmProvider: result.provider, llmModel: result.model, llmDurationMs: result.durationMs };
  PERSONA_CACHE.set(cacheKey, persona);
  if (PERSONA_CACHE.size > 200) {
    const first = PERSONA_CACHE.keys().next().value;
    PERSONA_CACHE.delete(first);
  }
  return persona;
}

export async function runAudienceAgent({ city, category, language, brand }) {
  const id = `audience-${Date.now()}`;
  emit({ type: "agent_start", agent: "audience", runId: id, city, category });
  const t0 = Date.now();
  try {
    emit({ type: "agent_progress", agent: "audience", runId: id, stage: "persona_generation" });
    const persona = await generatePersona({ city, category, language, brand });
    const result = {
      runId: id,
      city,
      category,
      language,
      brand,
      persona,
      demographics: getDemographics(city),
      durationMs: Date.now() - t0,
      timestamp: new Date().toISOString()
    };
    emit({ type: "agent_complete", agent: "audience", runId: id, result, durationMs: result.durationMs });
    return result;
  } catch (e) {
    emit({ type: "agent_error", agent: "audience", runId: id, error: e.message });
    throw e;
  }
}

export const audienceAgent = { run: runAudienceAgent, getDemographics };
export default audienceAgent;
