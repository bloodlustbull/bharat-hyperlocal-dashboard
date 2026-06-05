import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCampaignChain, getActiveRuns, getHistory, shutdown, DEFAULT_INPUT } from "../backend/agents/orchestrator.js";
import { subscribe } from "../backend/agents/event-bus.js";

describe("Orchestrator", () => {
  it("DEFAULT_INPUT has all expected fields", () => {
    assert.ok(DEFAULT_INPUT.brand);
    assert.ok(DEFAULT_INPUT.city);
    assert.ok(DEFAULT_INPUT.category);
    assert.ok(DEFAULT_INPUT.language);
    assert.ok(typeof DEFAULT_INPUT.budget === "number");
    assert.ok(typeof DEFAULT_INPUT.variantCount === "number");
  });

  it("runCampaignChain runs all 5 stages", async () => {
    const events = [];
    const unsub = subscribe(e => { if (e.type?.startsWith("chain_")) events.push(e); });
    try {
      const result = await runCampaignChain({ brand: "blinkit", city: "Hyderabad", category: "Grocery", language: "Telugu", budget: 50000, variantCount: 5 });
      assert.equal(result.status, "complete");
      assert.ok(result.chainId);
      assert.ok(result.research);
      assert.ok(result.audience);
      assert.ok(result.copy);
      assert.ok(result.channel);
      assert.ok(result.compliance);
      assert.equal(result.stageTimeline.length, 5, "all 5 stages tracked");
      assert.ok(typeof result.totalDurationMs === "number");
      assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
    } finally { unsub(); }
  });

  it("stages fire in correct order", async () => {
    const order = [];
    const unsub = subscribe(e => { if (e.type === "chain_stage_start") order.push(e.stage); });
    try {
      await runCampaignChain({ brand: "zepto", city: "Mumbai", category: "Snacks", language: "Hindi", budget: 30000, variantCount: 3 });
    } finally { unsub(); }
    assert.deepEqual(order, ["research", "audience", "copy", "channel", "compliance"]);
  });

  it("chain_start event has totalStages=5", async () => {
    let chainStart = null;
    const unsub = subscribe(e => { if (e.type === "chain_start") chainStart = e; });
    try {
      await runCampaignChain({ brand: "blinkit", city: "Delhi", category: "Dairy", language: "Hindi", budget: 25000, variantCount: 5 });
    } finally { unsub(); }
    assert.ok(chainStart, "chain_start fired");
    assert.equal(chainStart.totalStages, 5);
    assert.ok(chainStart.chainId);
    assert.ok(chainStart.input);
  });

  it("getHistory returns previous runs", async () => {
    await runCampaignChain({ brand: "blinkit", city: "Pune", category: "Grocery", language: "Marathi", budget: 20000, variantCount: 3 });
    const hist = getHistory(5);
    assert.ok(hist.length >= 1, "should have at least one history entry");
    const latest = hist[0];
    assert.ok(latest.chainId);
    assert.ok(latest.input);
    assert.equal(latest.status, "complete");
  });

  it("getActiveRuns empty after completion", async () => {
    await runCampaignChain({ brand: "instamart", city: "Bangalore", category: "Grocery", language: "Kannada", budget: 40000, variantCount: 5 });
    assert.equal(getActiveRuns().length, 0);
  });

  it("shutdown clears active runs", async () => {
    const before = getHistory().length;
    shutdown();
    const after = getHistory().length;
    assert.equal(after, before, "shutdown does not clear history");
    assert.equal(getActiveRuns().length, 0, "shutdown clears active");
  });

  it("overallScore higher when more stages succeed", async () => {
    const r = await runCampaignChain({ brand: "bigbasket", city: "Chennai", category: "Grocery", language: "Tamil", budget: 60000, variantCount: 5 });
    assert.ok(r.overallScore >= 50, "baseline score should be at least 50 on success");
  });
});
