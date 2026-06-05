# Bharat Hyperlocal GTM Dashboard

An AI-powered, city-language growth engine for Indian quick-commerce GTM teams. Built as a local-first control room for marketing strategists, ops leads, and product managers working with Zepto, Blinkit, Swiggy Instamart, BigBasket, and other dense hyperlocal operators.

The dashboard combines a public-data market view, a transparent city-language scoring model, a content brief generator, a WhatsApp funnel planner, an experiment tracker, and a live multi-agent AI campaign factory — all running locally with no third-party data exfiltration.

---

## Highlights

- **Public-data market view** — competitor metrics from CareEdge Advisory, Swiggy shareholder letters, BofA / ET / Reuters coverage. Sources documented in [`docs/SOURCES.md`](docs/SOURCES.md).
- **Transparent scoring model** — city × language × category, eight weighted dimensions, confidence-tagged.
- **Content brief generator** — copy, deliverables, do/don'ts, generated from real LLM calls (Groq, Mistral, or local Ollama).
- **WhatsApp funnel planner** — turn a strategy into a channel-ready message sequence.
- **Experiment tracker** — upload a pilot CSV; the dashboard calculates CTR, CAC, conversion, and repeat rate from real rows.
- **Campaign Factory** — a 5-agent live AI chain (`Research → Audience → Copy → Channel → Compliance`) with a real-time visualizer, Server-Sent Events, and an ASCI/FSSAI compliance gate.

---

## Quick start

### Prerequisites

- Node.js 20+ (Node 24 recommended)
- A modern browser
- Windows, macOS, or Linux

### Install and run

```bash
git clone https://github.com/bloodlustbull/bharat-hyperlocal-dashboard.git
cd bharat-hyperlocal-dashboard
npm install
npm run dev
```

This starts:

- **Frontend** (Vite dev server): <http://127.0.0.1:5500/index.html>
- **Backend** (Node, RAG + agent runtime): <http://127.0.0.1:8787>

On Windows, the same flow is available via `Run-Dashboard.bat`. To install a Windows-startup shortcut that auto-launches the dashboard on sign-in:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Install-Dashboard-AutoStart.ps1
```

### Production build

```bash
npm run build      # outputs to dist/
npm test           # 81 tests (agents, orchestrator, security, data integrity)
```

---

## What is real data and what is not?

| Source | Status |
|---|---|
| Public market metrics | Real (cited in `docs/SOURCES.md`) |
| City-language score | Decision model, **not** external fact — confidence level D |
| Pilot CTR / CAC / CVR | Real — uploaded by you, never faked |
| LLM-generated copy, personas, plans | Real LLM calls when a key is configured; deterministic fallback otherwise |

The dashboard never fakes campaign metrics. Pilot performance is always your own CSV.

---

## Campaign Factory

The factory is an on-demand, synchronous AI pipeline that turns one input (`brand`, `city`, `category`, `language`, `budget`) into a publishable hyperlocal campaign. Five agents chain together:

1. **Research** — Tavily + Google News RSS, LLM-summarized intelligence
2. **Audience** — 11-city demographics + LLM-generated persona (name, routine, quote in target language)
3. **Copy** — 5 ad variants across WhatsApp, Instagram Reels, Google Search, display, push, YouTube Shorts, plus a content brief
4. **Channel** — performance prediction from channel benchmarks, LLM-generated 7-day media plan
5. **Compliance** — ASCI India + FSSAI pattern check, LLM audit, `pass` / `needs_revision` / `block` verdict

Every agent makes a **real LLM call**. The browser receives a live event stream via Server-Sent Events and renders each agent's state in real-time.

### Configure providers (all have free tiers)

Copy the template and fill in only the keys you need:

```bash
cp backend/.env.example backend/.env.local
```

```bash
# backend/.env.local
GROQ_API_KEY=gsk_...            # https://console.groq.com
MISTRAL_API_KEY=...             # https://console.mistral.ai
# OLLAMA_ENABLED=true           # local Ollama fallback (no key)
LLM_PROVIDER_ORDER=groq,mistral,ollama
TAVILY_API_KEY=tvly-...         # optional, for live research feed
```

Without any keys, the agents still run — they fall back to deterministic personas and skip the LLM-only stages. The orchestrator's overall score reflects this.

Full architecture, API reference, and cost analysis: **[docs/CAMPAIGN_FACTORY.md](docs/CAMPAIGN_FACTORY.md)**.

### Run a chain

1. Open the dashboard, click the **Campaign Factory** tab.
2. Pick brand, city, category, language, budget.
3. Click **▶ Run the chain**.
4. Watch the 5 nodes turn amber (running) → green (complete) in order.
5. Read the campaign package: persona, performance prediction, variants, media plan, compliance verdict.
6. Export the campaign as JSON for handoff to creative or media ops.

---

## Project structure

```
bharat-hyperlocal-dashboard/
├── index.html                  Dashboard page
├── styles.css                  Design system
├── app.js                      Charts, scoring, CSV upload, factory UI
├── README.md                   This file
├── package.json
│
├── data/
│   ├── public_market_data.json        Public quick-commerce data
│   ├── city_language_seed.json        Scoring model and assumptions
│   ├── campaign_template.csv          Empty template for pilot uploads
│   ├── evidence_pack.local.json       (gitignored) local RAG store
│   ├── brief_cache.json               (gitignored) brief cache
│   └── metrics_history.json           (gitignored) live metrics
│
├── docs/
│   ├── SOURCES.md                     Source list and confidence rules
│   ├── CAMPAIGN_FACTORY.md            Architecture + API reference
│   └── RAG_EVIDENCE_BACKEND.md        Backend internals
│
├── backend/
│   ├── server.js                      HTTP API (12 campaign-factory routes)
│   ├── llm.js                         Groq + Mistral + Ollama provider abstraction
│   ├── secure-config.js               Env loader + key validation
│   ├── observability.js               Metrics
│   ├── health.js                      Health probes
│   ├── .env.example                   Placeholder template
│   ├── .env.local                     (gitignored) your real keys
│   └── agents/
│       ├── event-bus.js               Pub/sub for agent events
│       ├── research-agent.js          Tavily + Google News RSS + LLM
│       ├── audience-agent.js          11-city demographics + LLM persona
│       ├── copy-agent.js              Ad variants + content brief
│       ├── channel-agent.js           Performance prediction + media plan
│       ├── compliance-agent.js        ASCI/FSSAI pattern + LLM audit
│       └── orchestrator.js            5-agent state machine + SSE
│
├── scripts/
│   ├── start-all.ps1                  Cross-platform launcher
│   ├── Start-Dashboard.ps1            Windows-only launcher
│   ├── Install-Dashboard-AutoStart.ps1 Windows startup shortcut
│   ├── security-scan.mjs              Secret-pattern scanner
│   ├── fetch-keys.js                  Security audit (refuses import)
│   └── …
│
├── security-reports/
│   └── free-llm-api-keys-audit.json   Record of refused third-party key import
│
├── test/                              81 tests across 9 files
│
├── SECURITY.md                        Security policy
└── .gitignore
```

---

## Security

- **Zero secrets in source.** All keys load from `backend/.env.local` (gitignored). The frontend makes no direct calls to LLM providers, search APIs, or paid third parties.
- **No key redaction failures.** The full git history has been scanned for real secret patterns (Groq, OpenAI, Tavily, Google, AWS, GitHub, JWT, private keys). None have ever been committed.
- **Repeating scan.** Run `node scripts/security-scan.mjs` to verify. The scan is wired into the test suite (`test/security.test.mjs`).
- **OpenAI base-URL is locked by default.** `secure-config.js` rejects custom `OPENAI_BASE_URL` unless `ALLOW_CUSTOM_OPENAI_BASE_URL=true` is set explicitly.

Full policy: **[SECURITY.md](SECURITY.md)**.

---

## Adding real campaign data

Open `data/campaign_template.csv` and keep the headers:

```csv
experiment_id,date,city,language,category,channel,spend_inr,impressions,clicks,app_opens,add_to_carts,orders,revenue_inr,repeat_orders_7d,notes
```

Append your rows after a real pilot. The dashboard calculates delivery rate, open rate, CTR, reply rate, CVR, repeat rate, CAC proxy, and ROAS from these rows. No synthetic numbers.

---

## Scoring model — explainer

The city-language-category score is a transparent decision model, not a public fact. It is built from eight weighted dimensions:

- quick-commerce city density
- category purchase frequency
- vernacular content gap
- platform maturity
- WhatsApp conversion fit
- creator supply
- payment / logistics readiness
- competitive gap

Use it to choose what to **test**, not to claim what is already proven. Confidence is tagged as **D** until replaced with real campaign data from the experiment tracker.

---

## License

This project is intended for personal portfolio and research use. Public market data is cited at source. LLM-generated content is produced at runtime and is not redistributed.
