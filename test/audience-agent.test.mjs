import { describe, it } from "node:test";
import assert from "node:assert/strict";
import audienceAgent, { runAudienceAgent } from "../backend/agents/audience-agent.js";

describe("Audience agent", () => {
  it("exports demographics for known cities", () => {
    const demo = audienceAgent.getDemographics("Hyderabad");
    assert.equal(demo.tier, "tier-1");
    assert.ok(demo.avgAOV > 0);
    assert.ok(Array.isArray(demo.languages));
    const mumbai = audienceAgent.getDemographics("Mumbai");
    assert.ok(mumbai.languages.includes("Marathi"));
  });

  it("returns default demographics for unknown city", () => {
    const d = audienceAgent.getDemographics("Atlantis");
    assert.equal(d.tier, "tier-2");
    assert.ok(d.avgAOV > 0);
  });

  it("run produces a persona with required fields", async () => {
    const result = await runAudienceAgent({ city: "Pune", category: "Snacks", language: "Marathi", brand: "blinkit" });
    assert.equal(result.city, "Pune");
    assert.equal(result.category, "Snacks");
    assert.ok(result.persona, "should have persona");
    assert.ok(result.persona.name, "persona needs name");
    assert.ok(typeof result.persona.age === "number" || typeof result.persona.age === "string");
    assert.ok(Array.isArray(result.persona.preferredChannels));
    assert.ok(result.persona.preferredChannels.length >= 1);
    assert.ok(typeof result.persona.willingnessToPay === "number");
    assert.ok(result.persona.keyQuote, "persona needs keyQuote");
    assert.ok(result.demographics);
  });

  it("falls back gracefully when LLM unavailable", async () => {
    const result = await runAudienceAgent({ city: "Kochi", category: "Dairy", language: "Malayalam", brand: "zepto" });
    assert.ok(result.persona);
    assert.equal(result.persona.llmFallback, true);
    assert.equal(result.persona.llmProvider, null);
  });

  it("different cities produce different city context", async () => {
    const hyd = await runAudienceAgent({ city: "Hyderabad", category: "Grocery", language: "Telugu", brand: "blinkit" });
    const del = await runAudienceAgent({ city: "Delhi", category: "Grocery", language: "Hindi", brand: "blinkit" });
    assert.equal(hyd.city, "Hyderabad");
    assert.equal(del.city, "Delhi");
    const hydDemo = hyd.demographics.languages.join(",");
    const delDemo = del.demographics.languages.join(",");
    assert.notEqual(hydDemo, delDemo);
  });
});
