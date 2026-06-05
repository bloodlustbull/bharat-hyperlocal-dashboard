# Bharat Hyperlocal AI Backend

This backend adds a Dockerized FastAPI orchestration layer for the dashboard.

## Run

```powershell
cd backend
Copy-Item .env.example .env
# Fill ANTHROPIC_API_KEY and TAVILY_API_KEY in .env
docker-compose up --build
```

## Services

- `orchestrator`: FastAPI API on `http://localhost:8000`
- `signal-agent`: internal Tavily signal service on port `8001`
- `redis`: one-hour signal cache
- `postgres`: campaign, signal, price-watch, experiment-plan, and learning storage

## Smoke Tests

```powershell
curl -X POST http://localhost:8000/api/brief -H "Content-Type: application/json" -d "{\"city\":\"Hyderabad\",\"language\":\"Telugu\",\"category\":\"Snacks & Beverages\",\"platform\":\"zepto\",\"objective\":\"First order\",\"channel\":\"WhatsApp broadcast\",\"offer\":\"First-order coupon\",\"tone\":\"Local\",\"benchmarkPlatform\":\"blinkit\"}"

curl -X POST http://localhost:8000/api/campaign -H "Content-Type: application/json" -d "{\"city\":\"Hyderabad\",\"language\":\"Telugu\",\"category\":\"Snacks & Beverages\",\"objective\":\"First order\",\"channel\":\"WhatsApp\",\"offer\":\"First-order coupon\",\"tone\":\"Local\"}"

curl -X POST http://localhost:8000/api/report -H "Content-Type: application/json" -d "{\"platform\":\"zepto\",\"city\":\"Hyderabad\",\"language\":\"Telugu\",\"category\":\"Snacks & Beverages\",\"objective\":\"First order\",\"offer\":\"First-order coupon\",\"tone\":\"Local\",\"channels\":[\"WhatsApp broadcast\",\"Instagram Reels\"],\"notes\":\"Pilot only, no performance claims yet.\"}"

curl -X POST http://localhost:8000/api/planner -H "Content-Type: application/json" -d "{\"platform\":\"zepto\",\"city\":\"Hyderabad\",\"language\":\"Telugu\",\"category\":\"Snacks & Beverages\",\"objective\":\"First order\",\"budget\":\"INR 5K-15K\",\"duration\":\"7 days\",\"offer\":\"First-order coupon\",\"channels\":[\"WhatsApp broadcast\",\"Instagram Reels\"]}"

curl -X POST http://localhost:8000/api/uniteconomics -H "Content-Type: application/json" -d "{\"aov\":527,\"margin_pct\":18,\"repeat_orders_month\":2.4,\"cac\":300,\"lifetime_months\":3}"

curl -X POST http://localhost:8000/api/signals -H "Content-Type: application/json" -d "{\"city\":\"Hyderabad\",\"category\":\"Snacks & Beverages\"}"

curl -X POST http://localhost:8000/api/pricewatch -H "Content-Type: application/json" -d "{\"sku\":\"Bingo Mad Angles 160g\",\"your_price\":100,\"competitor_price\":88,\"city\":\"Hyderabad\",\"platform\":\"Blinkit\"}"
```

## Verify Postgres

```powershell
docker exec -it backend-postgres-1 psql -U bharat -d bharat_gtm -c "SELECT city, language, created_at FROM campaigns ORDER BY created_at DESC LIMIT 5;"
```

## CORS Fix

If the browser blocks API calls, edit `backend/orchestrator/main.py` and add your frontend origin to `allow_origins`, for example:

```python
"http://127.0.0.1:5501"
```

Then restart:

```powershell
docker-compose up --build
```
