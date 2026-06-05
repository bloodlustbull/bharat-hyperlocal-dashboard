import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emit, subscribe, clear, size } from "../backend/agents/event-bus.js";

describe("Event bus", () => {
  it("emits events to subscribers", () => {
    clear();
    const received = [];
    const unsub = subscribe(e => received.push(e));
    emit({ type: "test_event", payload: 1 });
    emit({ type: "test_event", payload: 2 });
    assert.equal(received.length, 2);
    assert.equal(received[0].type, "test_event");
    assert.equal(received[0].payload, 1);
    assert.ok(received[0].timestamp, "should add timestamp");
    unsub();
  });

  it("unsubscribe stops delivery", () => {
    clear();
    const received = [];
    const unsub = subscribe(e => received.push(e));
    emit({ type: "x" });
    unsub();
    emit({ type: "x" });
    assert.equal(received.length, 1);
  });

  it("multiple subscribers all receive events", () => {
    clear();
    const a = []; const b = [];
    const ua = subscribe(e => a.push(e));
    const ub = subscribe(e => b.push(e));
    emit({ type: "fanout" });
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    ua(); ub();
  });

  it("subscriber that throws does not break other subscribers", () => {
    clear();
    const good = [];
    subscribe(() => { throw new Error("boom"); });
    const u2 = subscribe(e => good.push(e));
    emit({ type: "robust" });
    assert.equal(good.length, 1);
    u2();
  });

  it("size() reflects active subscribers", () => {
    clear();
    assert.equal(size(), 0);
    const u1 = subscribe(() => {});
    assert.equal(size(), 1);
    const u2 = subscribe(() => {});
    assert.equal(size(), 2);
    u1(); u2();
    assert.equal(size(), 0);
  });
});
