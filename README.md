# Bharat Hyperlocal GTM Machine — Local Dashboard

This is a local, offline-friendly dashboard for the redesigned project:

**Bharat Hyperlocal GTM Machine**  
AI-powered city-language growth engine for Indian quick-commerce GTM.

The old project was broad vernacular GTM. This version is focused on quick commerce: Zepto, Blinkit, Swiggy Instamart, BigBasket Now, and similar dense hyperlocal operators.

---

## What this dashboard does

Think of this dashboard like a control room.

It has five main rooms:

1. **Market Pulse** — shows real public quick-commerce data.
2. **City-Language Scorer** — scores which city-language-category wedge to test.
3. **Content Brief Generator** — creates a campaign brief for the selected wedge.
4. **WhatsApp Funnel** — creates a funnel/copy skeleton.
5. **Experiment Tracker** — lets you upload real pilot campaign data later.

---

## What is real data and what is not?

### Real public data

The market and competitor metrics come from public sources:

- CareEdge Advisory quick-commerce report
- Swiggy Q4 FY2025 shareholder letter
- Economic Times article citing BofA on Blinkit market share
- Reuters report on Zepto funding/valuation

### Model assumptions

The city-language score is a transparent decision model. It is not an external fact. It is marked as confidence level **D** until replaced with campaign or primary city data.

### Your future live campaign data

CTR, CAC, conversion rate, and repeat order rate are **not faked**. The dashboard waits for your own CSV upload.

---

## How to run this locally

### Recommended: double-click launcher

Double-click:

```text
Run-Dashboard.bat
```

It starts the dashboard on the fixed local address:

```text
http://127.0.0.1:3000/index.html
```

Use this instead of the VS Code Live Server extension. If your laptop sleeps or VS Code is closed, run `Run-Dashboard.bat` again and the same link will work. Do not use the old Live Server `5500` link; VS Code can take that port over.

Optional Windows auto-start:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Install-Dashboard-AutoStart.ps1
```

That installs a Windows Startup shortcut so the local dashboard server starts automatically after you sign in.

---

## Old VS Code Live Server method

### Step 1: Open the folder

Open VS Code.

Click:

```text
File → Open Folder → bharat-hyperlocal-dashboard
```

Simple explanation: you are telling VS Code, “This is my project folder.”

---

### Step 2: Install Live Server extension

In VS Code:

```text
Extensions → search “Live Server” → Install
```

Simple explanation: Live Server is like a tiny local shopkeeper. It serves your dashboard to your browser so the JSON data files load properly.

---

### Step 3: Start the dashboard

Right-click `index.html` and click:

```text
Open with Live Server
```

A browser window should open.

Simple explanation: this opens the dashboard like a website, but it is running only on your laptop.

---

## How to use the dashboard in a manager demo

### Recommended talking flow

1. Start with **Market Pulse**.
   - Show that the dashboard uses real public quick-commerce data.
   - Say that campaign metrics are not faked.

2. Move to **City-Language Scorer**.
   - Select a city, language, and category.
   - Explain that this creates a testable GTM wedge.

3. Move to **Content Brief Generator**.
   - Show the campaign brief generated from the selected wedge.

4. Move to **WhatsApp Funnel**.
   - Show how the dashboard turns the strategy into a channel plan.

5. Move to **Experiment Tracker**.
   - Explain that once a pilot is run, the CSV can be uploaded to calculate CTR, CAC, CVR, and repeat rate.

---

## How to add real campaign data later

Open:

```text
data/campaign_template.csv
```

Keep the same headers:

```csv
experiment_id,date,city,language,category,channel,spend_inr,impressions,clicks,app_opens,add_to_carts,orders,revenue_inr,repeat_orders_7d,notes
```

Add your rows below the header.

Example after you run a real campaign:

```csv
QC001,2026-06-01,Hyderabad,Telugu,Snacks & Beverages,WhatsApp,1500,5000,350,220,80,35,8750,7,Real pilot campaign
```

Do not add fake rows for the final project. Add only real campaign rows once you run them.

---

## File guide

```text
index.html                  The dashboard page/body
styles.css                  The design/McKinsey-style look
app.js                      The logic, charts, scoring, CSV upload
README.md                   This instruction file
data/public_market_data.json Real public market data used in dashboard
data/city_language_seed.json Scoring model seed data and assumptions
data/campaign_template.csv  Empty template for your future pilot data
docs/SOURCES.md             Source list and confidence rules
```

---

## How to explain the scoring model

The scorer uses this structure:

```text
city + language + category → weighted score out of 100
```

The current dimensions are:

- quick-commerce city density
- category purchase frequency
- vernacular content gap
- platform maturity
- WhatsApp conversion fit
- creator supply
- payment/logistics readiness
- competitive gap

Important: this score is not a public fact. It is a decision model. Use it to choose what to test, not to claim what is already proven.

---

## What would make the project 95+/100

To make this a top-tier portfolio project:

1. Run a small real pilot.
2. Use two languages: English control + one vernacular language.
3. Use one city and one category.
4. Spend even a small amount if possible.
5. Record impressions, clicks, app opens, orders, revenue, and repeat orders.
6. Upload the CSV into this dashboard.
7. Let the dashboard calculate CAC, CTR, CVR, and repeat rate.

Without live pilot data, this is a strong public-data + model dashboard. With live campaign data, it becomes a real GTM machine.
