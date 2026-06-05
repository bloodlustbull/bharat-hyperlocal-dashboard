import { describe, it } from "node:test";
import assert from "node:assert/strict";
import researchAgent, { runResearchAgent, getAllResearch, clearResearchCache } from "../backend/agents/research-agent.js";

describe("Research agent", () => {
  it("exports refresh interval and cache TTL", () => {
    assert.ok(typeof researchAgent.refreshMs === "number");
    assert.ok(typeof researchAgent.cacheTtlMs === "number");
    assert.ok(researchAgent.refreshMs > 0);
    assert.ok(researchAgent.cacheTtlMs > 0);
  });

  it("clearResearchCache empties state", () => {
    clearResearchCache();
    assert.equal(getAllResearch().length, 0);
  });

  it("run with no LLM and no Tavily still completes", async () => {
    const originalKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    try {
      const r = await runResearchAgent({ brand: "blinkit", city: "" });
      assert.equal(r.brand, "blinkit");
      assert.equal(typeof r.durationMs, "number");
      assert.equal(typeof r.sources, "number");
    } finally {
      if (originalKey) process.env.TAVILY_API_KEY = originalKey;
    }
  });

  it("run returns expected shape", async () => {
    const r = await runResearchAgent({ brand: "zepto", city: "Bangalore" });
    assert.ok(r.runId);
    assert.equal(r.brand, "zepto");
    assert.equal(r.city, "Bangalore");
    assert.ok(r.timestamp);
    assert.ok(r.evidence);
    assert.ok(Array.isArray(r.evidence));
  });

  it("emits agent events on run", async () => {
    const events = [];
    const { subscribe } = await import("../backend/agents/event-bus.js");
    const unsub = subscribe(e => { if (e.agent === "research") events.push(e); });
    try {
      await runResearchAgent({ brand: "instamart", city: "" });
    } finally { unsub(); }
    const types = events.map(e => e.type);
    assert.ok(types.includes("agent_start"));
    assert.ok(types.includes("agent_complete"));
  });

  it("caches result on second call (force=false)", async () => {
    const a = await runResearchAgent({ brand: "bigbasket", city: "" });
    const b = await runResearchAgent({ brand: "bigbasket", city: "" });
    assert.equal(b.fromCache, true, "second call should hit cache");
    assert.notEqual(a.runId, b.runId, "different runId but same content");
  });

  it("force=true bypasses cache", async () => {
    const a = await runResearchAgent({ brand: "bigbasket", city: "" });
    const b = await runResearchAgent({ brand: "bigbasket", city: "" }, { force: true });
    assert.notEqual(b.fromCache, true, "force call should not hit cache");
  });
});
