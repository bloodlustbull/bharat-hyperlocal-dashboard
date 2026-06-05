# Security Policy

## Secrets and credentials

This repository ships **zero secrets**. All API keys, tokens, and credentials are loaded at runtime from `backend/.env.local`, which is gitignored. To run the project with real LLM providers:

1. Copy the template: `cp backend/.env.example backend/.env.local`
2. Fill in only the keys you need. Free-tier keys are sufficient.
3. Never commit `backend/.env.local` — the `.gitignore` blocks it.

The frontend (`index.html`, `app.js`, `styles.css`) makes no direct calls to LLM providers, search APIs, or paid third parties. Every request goes through the Node backend, which holds the only copies of the credentials.

## What is tracked vs. ignored

**Tracked (in git):**
- `backend/.env.example` — placeholder values only, safe to commit
- All source code
- All documentation
- The security audit report at `security-reports/free-llm-api-keys-audit.json` — a record showing that the project **refused** to import public third-party keys during an audit. The previews in that file are partial redactions (first 6 characters + `...redacted`).

**Ignored (never committed):**
- `backend/.env`, `backend/.env.local`, `backend/.env.*.local`
- `data/evidence_pack.local.json`
- `data/brief_cache.json`
- `data/metrics_history.json`
- `data/pipeline_state.json`
- `data/*.local.json`
- `logs/`
- `node_modules/`, `dist/`, `.vite/`

## Reporting a vulnerability

If you discover a security issue, please open a private advisory on GitHub rather than a public issue. For sensitive disclosures, contact the maintainer directly.

## Key rotation

If a key has been exposed publicly (e.g. accidentally committed), rotate it immediately at the provider:

- **Groq**: https://console.groq.com — revoke and regenerate
- **Mistral**: https://console.mistral.ai — revoke and regenerate
- **Tavily**: https://app.tavily.com — revoke and regenerate

Then remove the key from git history using `git filter-repo` or BFG, and force-push. The new clean state will be at HEAD.

## Audit log

A scan of the public third-party "free LLM keys" repository was performed and recorded in `security-reports/free-llm-api-keys-audit.json`. The decision was `refused_key_import` — no third-party keys were extracted, saved, rotated, or used.

## Historical leak check

The full git history of this repository has been scanned for real secret patterns (Groq `gsk_*`, OpenAI `sk-*`, Tavily `tvly-*`, Google `AIza*`, AWS `AKIA*`, GitHub `gh*_*`, private-key headers, JWTs). **No real secrets have ever been committed.** The only matches are placeholder examples in `.env.example` and documentation files.
