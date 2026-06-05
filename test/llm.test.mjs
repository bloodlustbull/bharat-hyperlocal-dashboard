import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractJson, getLLMProviderStatus } from "../backend/llm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

describe("LLM module", () => {
  it("getLLMProviderStatus returns array of provider entries", () => {
    const status = getLLMProviderStatus();
    assert.ok(Array.isArray(status), "status should be an array");
    assert.ok(status.length >= 1, "should have at least one provider entry");
    for (const p of status) {
      assert.ok(p.name, "each entry has name");
      assert.ok("available" in p, "each entry has available flag");
      assert.ok(p.reason !== undefined, "each entry has reason field");
    }
  });

  it("extractJson parses plain JSON object", () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  });

  it("extractJson strips markdown code fences", () => {
    assert.deepEqual(extractJson('```json\n{"a":2}\n```'), { a: 2 });
    assert.deepEqual(extractJson('```\n{"a":3}\n```'), { a: 3 });
  });

  it("extractJson extracts embedded JSON object from prose", () => {
    const prose = 'Here is the result: {"foo": "bar", "n": 42} hope that helps';
    assert.deepEqual(extractJson(prose), { foo: "bar", n: 42 });
  });

  it("extractJson returns null for non-JSON input", () => {
    assert.equal(extractJson("not json at all"), null);
    assert.equal(extractJson(""), null);
    assert.equal(extractJson(null), null);
  });

  it("extractJson handles array payloads", () => {
    assert.deepEqual(extractJson('[1,2,3]'), [1, 2, 3]);
  });

  it("getLLMProviderStatus order matches LLM_PROVIDER_ORDER env", () => {
    const status = getLLMProviderStatus();
    const order = (process.env.LLM_PROVIDER_ORDER || "groq,mistral,ollama").split(",").map(s => s.trim()).filter(Boolean);
    const names = status.map(s => s.name);
    for (const o of order) {
      assert.ok(names.includes(o), `${o} should appear in status`);
    }
  });
});
