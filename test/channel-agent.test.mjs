import { describe, it } from "node:test";
import assert from "node:assert/strict";
import channelAgent, { runChannelAgent, predictPerformance, CHANNEL_BENCHMARKS } from "../backend/agents/channel-agent.js";

const SAMPLE_VARIANTS = [
  { id: "v1", channel: "whatsapp", hook: "Order now", body: "Free delivery", cta: "Order" },
  { id: "v2", channel: "instagram_reel", hook: "Try today", body: "10 min delivery", cta: "Shop" },
  { id: "v3", channel: "push_notification", hook: "Limited", body: "Today only", cta: "Tap" }
];

const SAMPLE_PERSONA = { willingnessToPay: 350, preferredChannels: ["WhatsApp", "Instagram"] };

describe("Channel agent", () => {
  it("predictPerformance returns predictions for variant list", () => {
    const p = predictPerformance({ variants: SAMPLE_VARIANTS, persona: SAMPLE_PERSONA, city: "Mumbai", category: "Grocery", budget: 50000 });
    assert.ok(p.predicted);
    assert.ok(typeof p.predicted.orders === "number");
    assert.ok(p.predicted.orders > 0, "should predict some orders");
    assert.ok(typeof p.predicted.revenue === "number");
    assert.ok(p.predicted.roas >= 0);
    assert.ok(p.predicted.cpa >= 0);
    assert.ok(Array.isArray(p.channelPlan));
    assert.equal(p.channelPlan.length, 3, "one plan entry per channel");
  });

  it("predictPerformance handles zero variants", () => {
    const p = predictPerformance({ variants: [], persona: SAMPLE_PERSONA, budget: 50000 });
    assert.equal(p.predicted.orders, 0);
    assert.equal(p.predicted.revenue, 0);
    assert.equal(p.predicted.roas, 0);
    assert.equal(p.channelPlan.length, 0);
  });

  it("predictPerformance respects budget", () => {
    const big = predictPerformance({ variants: SAMPLE_VARIANTS, persona: SAMPLE_PERSONA, budget: 200000 });
    const small = predictPerformance({ variants: SAMPLE_VARIANTS, persona: SAMPLE_PERSONA, budget: 10000 });
    assert.ok(big.predicted.orders > small.predicted.orders, "bigger budget → more orders");
  });

  it("CHANNEL_BENCHMARKS has all expected channels", () => {
    for (const ch of ["whatsapp", "instagram_reel", "google_search", "display_banner", "push_notification", "youtube_short"]) {
      assert.ok(CHANNEL_BENCHMARKS[ch], `${ch} should have benchmarks`);
      assert.ok(typeof CHANNEL_BENCHMARKS[ch].ctr === "number");
      assert.ok(typeof CHANNEL_BENCHMARKS[ch].cpa === "number");
      assert.ok(typeof CHANNEL_BENCHMARKS[ch].cpm === "number");
    }
  });

  it("run emits start and complete events", async () => {
    const events = [];
    const { subscribe } = await import("../backend/agents/event-bus.js");
    const unsub = subscribe(e => { if (e.agent === "channel") events.push(e); });
    try {
      await runChannelAgent({ persona: SAMPLE_PERSONA, variants: SAMPLE_VARIANTS, city: "Mumbai", category: "Grocery", language: "Hindi", brand: "blinkit", budget: 50000 });
    } finally { unsub(); }
    const types = events.map(e => e.type);
    assert.ok(types.includes("agent_start"));
    assert.ok(types.includes("agent_complete"));
  });

  it("run returns performance + plan", async () => {
    const r = await runChannelAgent({ persona: SAMPLE_PERSONA, variants: SAMPLE_VARIANTS, city: "Mumbai", category: "Grocery", language: "Hindi", brand: "blinkit", budget: 50000 });
    assert.ok(r.performance);
    assert.ok(r.performance.predicted);
    assert.ok(r.performance.channelPlan);
    assert.equal(r.budget, 50000);
  });
});
