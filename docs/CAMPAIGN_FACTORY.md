# Campaign Factory — 5-Agent Live AI Chain

A real, end-to-end AI pipeline that turns one input (`brand`, `city`, `category`, `language`, `budget`) into a publishable hyperlocal campaign: live market intelligence → persona → ad copy → media plan → compliance audit. **No templates. No mocks. Every agent makes real LLM calls** (Groq or Mistral), and the UI shows each agent firing in real-time via Server-Sent Events.

```
                ┌──────────────┐  chain_start  ┌────────────────────┐
                │   User UI    │ ────────────▶ │  Orchestrator      │
                │ (SSE client) │ ◀──────────── │  (state machine)   │
                └──────────────┘  chain_event  └─────────┬──────────┘
                                                          │
                  ┌─────────────────────┬─────────────────┼──────────────────┬─────────────────────┐
                  │                     │                 │                  │                     │
                  ▼                     ▼                 ▼                  ▼                     ▼
           ┌──────────────┐    ┌──────────────┐  ┌──────────────┐   ┌──────────────┐    ┌──────────────┐
           │   Research   │    │   Audience   │  │     Copy     │   │    Channel   │    │  Compliance  │
           │   Agent      │───▶│    Agent     │─▶│    Agent     │──▶│    Agent     │───▶│    Agent     │
           │  Tavily +    │    │  city demo   │  │  variants +  │   │  benchmarks  │    │  pattern +   │
           │  Google News │    │  + LLM       │  │  brief       │   │  + LLM plan  │    │  LLM audit   │
           └──────────────┘    └──────────────┘  └──────────────┘   └──────────────┘    └──────────────┘
                  │                     │                 │                  │                     │
                  └─────────────────────┴─────────────────┴──────────────────┴─────────────────────┘
                                                          │
                                                          ▼
                                                ┌──────────────────────┐
                                                │  Campaign Package    │
                                                │  (final JSON)        │
                                                └──────────────────────┘
```

## Why

The existing pipeline (ingestion → score → brief) is asynchronous and runs every 3 hours. The Campaign Factory is a **synchronous, on-demand chain** that a marketer runs while planning a single campaign. The whole pipeline is built so that:

1. **Zero-cost** — Groq free tier, Mistral free tier, Tavily free tier. Apify only used for scraping if user opts in.
2. **Real AI** — no template strings, no keyword replacement. Every agent calls a real LLM and reasons about the input.
3. **Live visibility** — Server-Sent Events stream every agent event to the browser; the UI shows a 5-node chain visualizer with status, timing, and a live log.
4. **Resilient** — JSON-parse auto-retry, LLM provider auto-failover (Groq → Mistral → Ollama), graceful fallback to deterministic personas/copy if no LLM is configured.
5. **Auditable** — Compliance agent runs **before** the campaign ships; ASCI India + FSSAI patterns and a full LLM audit. Block verdict prevents publishing.

## Architecture

### Agent order

| # | Agent        | Input                                            | Output                                                    |
|---|--------------|--------------------------------------------------|-----------------------------------------------------------|
| 1 | Research     | `brand`, `city`                                  | LLM summary + key developments + risk factors + sources   |
| 2 | Audience     | `city`, `category`, `language`, `brand`          | One hyper-specific persona (name, routines, quote in language) |
| 3 | Copy         | persona, `city`, `category`, `language`, `brand` | 5 ad copy variants across 6 channels + 1 content brief    |
| 4 | Channel      | persona, variants, `city`, `category`, `budget`  | Performance prediction + 7-day media plan + KPIs          |
| 5 | Compliance   | variants, `category`, `brand`                    | Pattern findings + LLM audit + verdict (pass/revise/block)|

Each agent consumes the previous agent's output and emits its own events to the bus.

### Provider abstraction (`backend/llm.js`)

Single module, three providers, automatic failover:

```
LLM_PROVIDER_ORDER=groq,mistral,ollama
```

- `groq` — Groq Cloud (`groq-sdk`), free tier, fast inference
- `mistral` — Mistral AI (`@mistralai/mistralai`), free tier
- `ollama` — Local Ollama, `OLLAMA_ENABLED=true`

`llmComplete(messages, opts)` and `llmJson(messages, opts)` are the only two entry points. `llmJson` strips markdown fences, extracts embedded JSON, and **auto-retries** with a stricter prompt if the first parse fails.

### Event bus (`backend/agents/event-bus.js`)

Tiny pub/sub used by every agent. Subscribers get `{...event, timestamp}`. The orchestrator subscribes once per chain to fold agent events into the chain stream.

### Orchestrator (`backend/agents/orchestrator.js`)

A simple async state machine — not a full LangGraph, because the marginal cost of a state-machine library for a 5-step chain is negative (more code, less clarity).

```
for each stage:
  stageStart(stage)
  result = await agent.run(input)
  stageEnd(stage, result)
```

- Tracks per-stage `durationMs` and `status`
- Emits `chain_start`, `chain_stage_start`, `chain_stage_end`, `chain_event`, `chain_complete`, `chain_error` to the bus
- Browser subscribes via SSE and renders the chain visualizer in real-time
- `shutdown()` is wired to `SIGINT`/`SIGTERM` for clean termination

### Compliance (`backend/agents/compliance-agent.js`)

Two-stage:

1. **Pattern check** — regex matchers for blocked claims (`best`, `#1`, `guaranteed`, `cure`, `heal`, `100% satisfaction`, etc.) and forbidden claims (`miracle`, `100% results`, `doctor recommended`, `WHO approved`).
2. **LLM audit** — full ASCI India + FSSAI audit. Returns severity-tagged findings with regulatory basis.

Verdict: `pass` / `needs_revision` / `block`. `block` removes the campaign from consideration.

## API Reference

All routes are mounted on the backend at `http://127.0.0.1:8787`.

### `GET /api/llm/status`

Returns provider status, configured order, and a setup hint if no provider is configured.

```json
{
  "providers": [{"name": "groq", "model": "llama-3.3-70b-versatile", "available": true, "type": "groq", "reason": null}],
  "order": ["groq", "mistral", "ollama"],
  "anyAvailable": true,
  "setupHint": null
}
```

### `POST /api/campaign/run`

Runs the full 5-agent chain. Returns the campaign package.

```bash
curl -X POST http://127.0.0.1:8787/api/campaign/run \
  -H "Content-Type: application/json" \
  -d '{"brand":"blinkit","city":"Hyderabad","category":"Grocery","language":"Telugu","budget":50000,"variantCount":5}'
```

Response:

```json
{
  "chainId": "chain-1780...",
  "status": "complete",
  "totalDurationMs": 9000,
  "overallScore": 70,
  "research": { "summary": {...}, "sources": 12, "durationMs": 3200 },
  "audience": { "persona": {...}, "demographics": {...}, "durationMs": 1100 },
  "copy": { "variants": [...5...], "brief": {...}, "provider": "groq", "model": "llama-3.3-70b-versatile" },
  "channel": { "performance": {...}, "plan": {...} },
  "compliance": { "overallVerdict": "pass", "riskScore": 12, "patternFindings": [...], "llmAudit": {...} },
  "stageTimeline": [
    {"name":"research","label":"🔍 ...","status":"complete","durationMs":3200},
    ...
  ]
}
```

### `GET /api/campaign/events/stream`

Server-Sent Events stream. Emits every agent and chain event. Browser subscribes via `new EventSource(...)`.

### `POST /api/agent/{research,audience,copy,channel,compliance}`

Run a single agent. Useful for the "Live Research" and "Content Brief Generator" panels.

### `GET /api/research/latest`, `POST /api/research/refresh`

Read or refresh cached research summaries per brand/city.

### `GET /api/campaign/active`, `GET /api/campaign/history`

Currently active runs and the last 50 history entries.

### `POST /api/brief/generate`

Generate just a content brief (no chain).

## UI (`index.html` + `app.js`)

New tab: **Campaign Factory**. Three panels:

1. **Live Agent Chain** — 5-node visualizer with real-time status (pending → running → complete/error), timing, and a live event log.
2. **Live Research** — refresh button hits the Research agent and renders LLM summary + key developments.
3. **Content Brief Generator** — single button that calls the Copy agent and renders a ready-to-publish brief.

A second section ("Final Campaign Package") appears after a chain run and renders:
- Overall score (0-100)
- Persona card
- Performance prediction (orders, revenue, ROAS, CPA)
- All 5 copy variants
- 7-day media plan + KPIs
- Compliance audit

Plus a "Export campaign JSON" button to save the package.

## Setup

### Required environment variables

`backend/.env.local`:

```bash
# At least one of these (free tiers)
GROQ_API_KEY=gsk_...              # https://console.groq.com
MISTRAL_API_KEY=...               # https://console.mistral.ai
# OLLAMA_ENABLED=true             # local fallback

# Order of failover
LLM_PROVIDER_ORDER=groq,mistral,ollama

# Research agent cache
TAVILY_API_KEY=tvly-...           # https://app.tavily.com (1000/mo free)
RESEARCH_REFRESH_MS=21600000      # 6h
CAMPAIGN_CACHE_TTL_MS=1800000     # 30m
```

If no LLM key is configured, agents still run but fall back to deterministic personas and skip the LLM-only stages. The orchestrator's overall score reflects this.

### Running

```bash
npm run dev     # starts backend on :8787 and frontend on :5500
npm test        # 74 tests
npm run build   # production build to dist/
```

## File map

```
backend/
├── llm.js                              # provider abstraction + auto-failover
├── server.js                           # 12 new routes for the factory
└── agents/
    ├── event-bus.js                    # pub/sub
    ├── research-agent.js               # Tavily + Google News RSS + LLM
    ├── audience-agent.js               # 11-city demographics + LLM persona
    ├── copy-agent.js                   # variants + content brief
    ├── channel-agent.js                # benchmarks + LLM media plan
    ├── compliance-agent.js             # ASCI/FSSAI pattern + LLM audit
    └── orchestrator.js                 # 5-agent state machine + SSE wiring

test/
├── event-bus.test.mjs
├── llm.test.mjs                        # extractJson, provider status
├── audience-agent.test.mjs
├── copy-agent.test.mjs
├── channel-agent.test.mjs
├── compliance-agent.test.mjs
├── research-agent.test.mjs
└── orchestrator.test.mjs

index.html                              # + Campaign Factory tab + 5-agent visualizer
styles.css                              # + factory-chain-visual, agent nodes, log
app.js                                  # + factoryState, SSE client, render functions
docs/CAMPAIGN_FACTORY.md                # this file
```

## Cost

- Groq free tier: 30 req/min, 14,400 req/day. The full chain uses ~5 LLM calls.
- Mistral free tier: 1 req/sec, 500K tokens/mo.
- Tavily free tier: 1,000 searches/mo.
- **Total spend: $0 for typical usage.**
