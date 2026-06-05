import { emit } from "./event-bus.js";
import { llm } from "../llm.js";

const BLOCKED_PATTERNS = [
  /\bbest\b/gi, /(^|\s)#1(\b|$)/gi, /\bguaranteed\b/gi, /\bcure\b/gi, /\bheal\b/gi,
  /100%\s*satisfaction/gi, /no\s*side\s*effects/gi, /\bfda\s*approved\b/gi
];

const FORBIDDEN_CLAIMS = [
  "weight loss guarantee", "instant cure", "100% results", "doctor recommended",
  "government approved", "WHO approved", "miracle", "magic"
];

const REGULATORY_RULES = {
  snacks: { asci: "FSSAI license number must be visible on packaging claim. No health claims without approved FSSAI nutrient profiles.", disclaimer: "FSSAI Lic. No. XXXXXXXXXXX" },
  dairy: { asci: "Pasteurized claim must specify. No raw milk claims.", disclaimer: "Pasteurized & homogenized" },
  beauty: { asci: "Dermatologically tested claims need study citation. No 'cure' or 'treat' language.", disclaimer: "For external use only" },
  "personal care": { asci: "Ayush license required for ayurvedic claims. Avoid therapeutic claims.", disclaimer: "As per Ayush standards" },
  personal_care: { asci: "Ayush license required for ayurvedic claims. Avoid therapeutic claims.", disclaimer: "As per Ayush standards" },
  electronics: { asci: "BIS mark mandatory for regulated electronics. Wattage/voltage claims verifiable.", disclaimer: "BIS R-XXXXXX" },
  grocery: { asci: "MRP visible. Country of origin mandatory for imported goods.", disclaimer: "MRP inclusive of all taxes" }
};

function categoryKey(c) {
  if (!c) return "grocery";
  return String(c).toLowerCase().trim().replace(/\s+/g, " ");
}

function patternCheck(variants) {
  const findings = [];
  for (const v of variants) {
    const hook = v.hook || "";
    const body = v.body || "";
    const text = `${hook} ${body}`;
    for (const p of BLOCKED_PATTERNS) {
      p.lastIndex = 0;
      const mHook = hook.match(p);
      p.lastIndex = 0;
      const mBody = body.match(p);
      if (mHook) {
        findings.push({ variantId: v.id, severity: "high", issue: `Blocked pattern: ${mHook[0]}`, location: "hook", recommendation: `Replace "${mHook[0]}" with specific, verifiable claim or remove.` });
      }
      if (mBody) {
        findings.push({ variantId: v.id, severity: "high", issue: `Blocked pattern: ${mBody[0]}`, location: "body", recommendation: `Replace "${mBody[0]}" with specific, verifiable claim or remove.` });
      }
    }
    const lower = text.toLowerCase();
    for (const claim of FORBIDDEN_CLAIMS) {
      if (lower.includes(claim.toLowerCase())) {
        findings.push({ variantId: v.id, severity: "critical", issue: `Forbidden claim: "${claim}"`, recommendation: "Remove entirely." });
      }
    }
  }
  return findings;
}

async function llmAudit({ variants, category, brand }) {
  const text = variants.map(v => `[${v.id}|${v.channel}] ${v.hook || ""} :: ${v.body || ""}`).join("\n");
  const reg = REGULATORY_RULES[categoryKey(category)] || REGULATORY_RULES.grocery;
  const messages = [
    {
      role: "system",
      content: `You are an ASCI India + FSSAI compliance auditor. Be strict but practical. Return ONLY valid JSON: {overallVerdict: "pass"|"needs_revision"|"block", riskScore: 0-100, findings: [{variantId, severity: "low"|"medium"|"high"|"critical", issue, recommendation, regulatoryBasis}], requiredDisclaimers: [string], brandApprovalNeeded: boolean}. No prose.`
    },
    {
      role: "user",
      content: `Audit these ad copy variants for ${brand} in category "${category}":

Category regulatory context: ${reg.asci}
Recommended disclaimer: ${reg.disclaimer}

Variants:
${text}

Flag: misleading superlatives, unsubstantiated health/financial claims, missing mandatory disclaimers, comparative advertising without disclosure, vulnerability exploitation, child-directed marketing without parental consent, regional language mistranslations.`
    }
  ];
  const result = await llm.json(messages, { maxTokens: 1500, temperature: 0.2 });
  if (!result.success) return null;
  return result.parsed;
}

export async function runComplianceAgent({ variants, category, brand }) {
  const id = `compliance-${Date.now()}`;
  emit({ type: "agent_start", agent: "compliance", runId: id, brand, category });
  const t0 = Date.now();
  try {
    emit({ type: "agent_progress", agent: "compliance", runId: id, stage: "pattern_check" });
    const patternFindings = patternCheck(variants || []);
    emit({ type: "agent_progress", agent: "compliance", runId: id, stage: "llm_audit" });
    const llmResult = await llmAudit({ variants: variants || [], category, brand });
    const reg = REGULATORY_RULES[category] || REGULATORY_RULES.grocery;
    const result = {
      runId: id,
      brand,
      category,
      patternFindings,
      llmAudit: llmResult,
      overallVerdict: llmResult?.overallVerdict || (patternFindings.some(f => f.severity === "critical") ? "block" : patternFindings.length > 3 ? "needs_revision" : "pass"),
      riskScore: llmResult?.riskScore ?? (patternFindings.length * 15),
      requiredDisclaimers: [...new Set([...(llmResult?.requiredDisclaimers || []), reg.disclaimer])],
      categoryKey: categoryKey(category),
      regulatoryContext: reg.asci,
      durationMs: Date.now() - t0,
      timestamp: new Date().toISOString()
    };
    emit({ type: "agent_complete", agent: "compliance", runId: id, result, durationMs: result.durationMs });
    return result;
  } catch (e) {
    emit({ type: "agent_error", agent: "compliance", runId: id, error: e.message });
    throw e;
  }
}

export const complianceAgent = { run: runComplianceAgent, patternCheck, REGULATORY_RULES };
export { REGULATORY_RULES, patternCheck };
export default complianceAgent;
