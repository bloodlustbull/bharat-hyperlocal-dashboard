# Codex Prompt for Improving This Dashboard

Use this prompt inside Codex after opening this project folder in VS Code.

```text
You are helping me build a local offline dashboard for a real-world portfolio project called Bharat Hyperlocal GTM Machine.

Read every file in this repository before editing: index.html, styles.css, app.js, README.md, docs/SOURCES.md, data/public_market_data.json, data/city_language_seed.json, and data/campaign_template.csv.

The project has been redesigned from a generic vernacular GTM report into a focused quick-commerce GTM dashboard. Keep the scope fixed: hyperlocal quick commerce in India, with examples like Zepto, Blinkit, Swiggy Instamart, BigBasket Now, and similar operators.

Allowed languages only: English, Telugu, Tamil, Hindi, Marathi, Kannada, Malayalam, Odia, Punjabi, Haryanvi. Do not add any other language.

Do not hallucinate. Do not invent campaign performance data. Do not create fake CTR, CAC, conversion rate, repeat purchase rate, or revenue numbers. Market and competitor data must come only from the public sources listed in docs/SOURCES.md. City-language scoring is a transparent model assumption and must remain marked as confidence level D until validated.

Improve the dashboard while keeping it dependency-free unless I explicitly ask for React/Vite. It should continue to run locally with VS Code Live Server. Keep comments beginner-friendly and explain what each major code block does.

Priorities:
1. Keep the McKinsey-style executive look: clean, sharp, premium, minimal, not colorful.
2. Preserve the pipeline: Market Pulse → City-Language Scorer → Content Brief Generator → WhatsApp Funnel → Experiment Tracker → Sources.
3. Improve interactivity only if it keeps the project honest and offline-friendly.
4. Make the Experiment Tracker work with uploaded real campaign CSVs using data/campaign_template.csv.
5. Add no unsupported claims.
6. Maintain source-confidence discipline: A primary/company source, B credible third-party, C vendor/case-study, D model assumption.

Before making changes, summarize what you found. After making changes, provide a changelog of modified files and exactly how to test locally.
```
