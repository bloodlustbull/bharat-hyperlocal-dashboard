import { describe, it } from "node:test";
import assert from "node:assert/strict";
import complianceAgent, { runComplianceAgent, patternCheck, REGULATORY_RULES } from "../backend/agents/compliance-agent.js";

describe("Compliance agent", () => {
  it("patternCheck flags 'best' and '#1' superlatives", () => {
    const findings = patternCheck([{ id: "v1", channel: "whatsapp", hook: "Best deals", body: "Order #1 product" }]);
    const issues = findings.map(f => f.issue).join(" ");
    assert.ok(/Best/.test(issues), "should flag 'Best'");
    assert.ok(/#1/.test(issues), "should flag '#1'");
  });

  it("patternCheck flags '100% results' as critical", () => {
    const findings = patternCheck([{ id: "v2", channel: "whatsapp", hook: "Try it", body: "100% results guaranteed" }]);
    const critical = findings.filter(f => f.severity === "critical");
    assert.ok(critical.length >= 1, "should have at least one critical finding");
    assert.ok(critical.some(f => /100% results/.test(f.issue)));
  });

  it("patternCheck flags 'miracle' as forbidden claim", () => {
    const findings = patternCheck([{ id: "v3", channel: "instagram_reel", hook: "Miracle cure", body: "Works instantly" }]);
    const critical = findings.filter(f => f.severity === "critical");
    assert.ok(critical.length >= 1);
  });

  it("patternCheck passes clean copy", () => {
    const findings = patternCheck([{ id: "v4", channel: "whatsapp", hook: "New on blinkit", body: "Order fresh groceries with free delivery above ₹199." }]);
    assert.equal(findings.length, 0);
  });

  it("patternCheck correctly attributes findings to hook vs body", () => {
    const findings = patternCheck([{ id: "v5", channel: "whatsapp", hook: "Best prices", body: "Order today" }]);
    const bestFinding = findings.find(f => /Best/.test(f.issue));
    assert.ok(bestFinding, "should find 'Best'");
    assert.equal(bestFinding.location, "hook", "should be attributed to hook");
  });

  it("patternCheck handles empty variants", () => {
    assert.deepEqual(patternCheck([]), []);
  });

  it("REGULATORY_RULES covers all expected categories", () => {
    for (const cat of ["snacks", "dairy", "beauty", "personal_care", "electronics", "grocery"]) {
      assert.ok(REGULATORY_RULES[cat], `${cat} should have rule`);
      assert.ok(REGULATORY_RULES[cat].asci);
      assert.ok(REGULATORY_RULES[cat].disclaimer);
    }
  });

  it("run emits agent_start and agent_complete events", async () => {
    const events = [];
    const { subscribe } = await import("../backend/agents/event-bus.js");
    const unsub = subscribe(e => { if (e.agent === "compliance") events.push(e); });
    try {
      await runComplianceAgent({ variants: [{ id: "v1", channel: "whatsapp", hook: "hi", body: "order now" }], category: "Grocery", brand: "blinkit" });
    } finally { unsub(); }
    const types = events.map(e => e.type);
    assert.ok(types.includes("agent_start"));
    assert.ok(types.includes("agent_complete"));
  });

  it("run returns verdict + risk score + disclaimers", async () => {
    const r = await runComplianceAgent({ variants: [{ id: "v1", channel: "whatsapp", hook: "hi", body: "order on blinkit" }], category: "Snacks", brand: "blinkit" });
    assert.ok(["pass", "needs_revision", "block"].includes(r.overallVerdict), "verdict is one of three");
    assert.ok(typeof r.riskScore === "number");
    assert.ok(Array.isArray(r.requiredDisclaimers));
    assert.ok(r.requiredDisclaimers.length > 0, "snacks needs FSSAI disclaimer");
  });

  it("blocks copy with critical findings", async () => {
    const r = await runComplianceAgent({ variants: [{ id: "v1", channel: "whatsapp", hook: "Best ever", body: "Miracle cure 100% results" }], category: "Snacks", brand: "blinkit" });
    assert.equal(r.overallVerdict, "block");
    assert.ok(r.riskScore > 0);
  });
});
