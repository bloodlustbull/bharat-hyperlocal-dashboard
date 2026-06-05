# Bharat RAG Backend

Local backend for the Evidence RAG tab.

## Run

```bash
npm run rag:server
```

Then open the dashboard and set the Evidence RAG API base URL to:

```text
http://127.0.0.1:8787/api/rag
```

## Environment Variables

The backend works without keys, but live scraping and AI generation need provider credentials:

Create `.env.local` in the project root using `.env.example` as the template. `.env.local` is ignored by git.

```text
LLM_PROVIDER=ollama
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
OPENAI_API_KEY=
OPENAI_API_KEYS=
OPENAI_MODEL=gpt-5
OPENAI_BASE_URL=https://api.openai.com/v1
ALLOW_CUSTOM_OPENAI_BASE_URL=false
TAVILY_API_KEY=
FIRECRAWL_API_KEY=
APIFY_TOKEN=
BRIGHT_DATA_API_KEY=
GOOGLE_ADS_DEVELOPER_TOKEN=
META_ACCESS_TOKEN=
SEARCHAPI_API_KEY=
WHATSAPP_ACCESS_TOKEN=
TWILIO_AUTH_TOKEN=
RAG_PORT=8787
CORS_ORIGIN=*
```

Current implementation:

- `/api/rag/health`: provider readiness.
- `/api/rag/evidence`: stored local evidence pack.
- `/api/rag/ingest`: runs configured ingestion jobs. Tavily live search works when `TAVILY_API_KEY` is set; URL extraction works through direct fetch; other providers are represented in readiness and can be extended safely server-side.
- `/api/rag/brief`: generates an evidence-grounded brief. Uses local Ollama by default, OpenAI Responses API when selected and configured, otherwise returns a deterministic citation-aware fallback.

## Free Local LLM: Ollama

Install Ollama from `https://ollama.com/`, then run:

```bash
ollama pull llama3.1:8b
ollama serve
```

Keep `.env.local` set to:

```text
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
```

This keeps prompts, evidence packs, and brief generation on your own machine.

## Key Handling

- Use only API keys that you own or are explicitly authorized to use.
- Public GitHub "free key" lists are treated as leaked or unauthorized credentials and are not imported.
- To rotate your own OpenAI-compatible keys locally, set `OPENAI_API_KEYS` as a comma-separated list.
- `OPENAI_BASE_URL` defaults to `https://api.openai.com/v1`. Custom endpoints are blocked unless `ALLOW_CUSTOM_OPENAI_BASE_URL=true`.

Audit an untrusted public key repo without importing credentials:

```bash
npm run keys:audit
```

The audit writes a local report under `security-reports/`, which is ignored by git.

Use only API keys and OpenAI-compatible endpoints you are authorized to use. Do not paste public shared keys from GitHub repos into `.env.local`.

Evidence is stored in:

```text
data/evidence_pack.local.json
```

Do not commit private evidence, API keys, downloaded screenshots, or provider exports unless they are intentionally public.
