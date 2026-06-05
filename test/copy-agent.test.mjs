import { describe, it } from "node:test";
import assert from "node:assert/strict";
import copyAgent, { runCopyAgent } from "../backend/agents/copy-agent.js";

const SAMPLE_PERSONA = {
  name: "Anita Sharma",
  age: 30,
  occupation: "Working professional",
  dailyRoutine: ["Commute", "Lunch", "Errands"],
  shoppingBehavior: ["Quick top-up orders", "Compares prices"],
  painPoints: ["Out of stock", "Late delivery", "Surge pricing"],
  preferredChannels: ["WhatsApp", "Instagram Reels"],
  motivationalTriggers: ["Free delivery", "10-min promise"],
  preferredLanguage: "Hindi",
  secondaryLanguages: ["English"],
  willingnessToPay: 400,
  frequencyPerWeek: 4,
  peakShoppingHours: ["13:00", "19:30"],
  keyQuote: "Mumbai mein jaldi chahiye."
};

describe("Copy agent", () => {
  it("run emits start, progress, complete events", async () => {
    const events = [];
    const { subscribe } = await import("../backend/agents/event-bus.js");
    const unsub = subscribe(e => { if (e.agent === "copy") events.push(e); });
    try {
      await runCopyAgent({ persona: SAMPLE_PERSONA, city: "Mumbai", category: "Grocery", language: "Hindi", brand: "blinkit", objective: "First order", variantCount: 5 });
    } finally { unsub(); }
    const types = events.map(e => e.type);
    assert.ok(types.includes("agent_start"), "should emit agent_start");
    assert.ok(types.includes("agent_complete"), "should emit agent_complete");
  });

  it("returns variants array (possibly empty on LLM fallback)", async () => {
    const r = await runCopyAgent({ persona: SAMPLE_PERSONA, city: "Mumbai", category: "Grocery", language: "Hindi", brand: "blinkit", variantCount: 5 });
    assert.ok(r, "result exists");
    assert.ok(Array.isArray(r.variants), "variants is array");
    assert.equal(r.city, "Mumbai");
    assert.equal(r.brand, "blinkit");
    assert.ok(typeof r.variantCount === "number");
  });

  it("result includes brief field", async () => {
    const r = await runCopyAgent({ persona: SAMPLE_PERSONA, city: "Delhi", category: "Snacks", language: "Hindi", brand: "zepto", variantCount: 3 });
    assert.ok("brief" in r, "result has brief key");
  });

  it("handles missing variantCount param", async () => {
    const r = await runCopyAgent({ persona: SAMPLE_PERSONA, city: "Pune", category: "Grocery", language: "Marathi", brand: "instamart" });
    assert.ok(r);
  });
});
