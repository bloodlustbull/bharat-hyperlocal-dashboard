/*
  app.js is the brain of the dashboard.
  Think of HTML as the body, CSS as clothes, and this file as the brain.
  It reads data, draws charts, responds when you click buttons, and calculates scores.
*/

// -----------------------------------------------------------------------------
// 1) FALLBACK DATA
// -----------------------------------------------------------------------------
// We keep fallback data inside this file so the dashboard still works even if
// your browser blocks loading local JSON files by double-clicking index.html.
// If you run with VS Code Live Server, the dashboard will load the JSON files.

const FALLBACK_MARKET_DATA = {
  kpis: [
    { label: "India Q-commerce GOV FY25", value: "₹64,000 Cr", caption: "CareEdge estimate for FY25 gross order value", sourceId: "careedge_2025" },
    { label: "Projected GOV FY28", value: "₹2,00,000 Cr", caption: "CareEdge projection: market nearly triples by FY28", sourceId: "careedge_2025" },
    { label: "Instamart Q4FY25 GOV", value: "₹4,670 Cr", caption: "Swiggy Q4FY25 shareholder letter", sourceId: "swiggy_q4fy25" },
    { label: "Instamart active dark stores", value: "1,021", caption: "Exit count as of March 2025", sourceId: "swiggy_q4fy25" },
    { label: "Blinkit market share", value: ">50%", caption: "BofA note cited by Economic Times", sourceId: "et_blinkit_2025" },
    { label: "Zepto valuation", value: "$7B", caption: "Reuters: $450M funding round in 2025", sourceId: "reuters_zepto_2025" },
    { label: "India dark stores FY25", value: "3,072", caption: "Major three players: Blinkit, Instamart, Zepto", sourceId: "careedge_2025" },
    { label: "Instamart MTUs Q4FY25", value: "9.8M", caption: "Average monthly transacting users", sourceId: "swiggy_q4fy25" }
  ],
  govSeries: [
    { period: "FY22", value: 4500 }, { period: "FY23", value: 16800 },
    { period: "FY24", value: 30000 }, { period: "FY25(E)", value: 64000 },
    { period: "FY28P", value: 200000 }
  ],
  darkStoreSeries: [
    { period: "FY23", value: 1400 }, { period: "FY24", value: 1800 }, { period: "FY25", value: 3072 }
  ],
  instamartSeries: [
    { period: "Q4FY24", gov: 2323, orders: 50.0, aov: 465, mtu: 4.7, stores: 523 },
    { period: "Q1FY25", gov: 2724, orders: 55.9, aov: 487, mtu: 5.2, stores: 557 },
    { period: "Q2FY25", gov: 3382, orders: 67.8, aov: 499, mtu: 6.2, stores: 609 },
    { period: "Q3FY25", gov: 3907, orders: 73.2, aov: 534, mtu: 7.0, stores: 705 },
    { period: "Q4FY25", gov: 4670, orders: 88.6, aov: 527, mtu: 9.8, stores: 1021 }
  ],
  sources: [
    { id: "careedge_2025", name: "CareEdge Advisory — India's Rapid Delivery Race: Q-Commerce set to Triple by 2028", type: "B", usedFor: "Q-commerce GOV FY22-FY28P, dark stores FY23-FY25, market overview", url: "https://www.careratings.com/uploads/newsfiles/1752146049_India%E2%80%99s%20Q-commerce%20Market%20-%20CareEdge%20Advisory%20Report.pdf" },
    { id: "swiggy_q4fy25", name: "Swiggy Q4 FY2025 Shareholder Letter", type: "A", usedFor: "Instamart GOV, AOV, total orders, MTUs, dark stores, city footprint", url: "https://www.swiggy.com/corporate/wp-content/uploads/2025/05/Q4-FY2025-Shareholder-letter.pdf" },
    { id: "et_blinkit_2025", name: "Economic Times — Blinkit tops quick commerce with over 50% market share, citing BofA", type: "B", usedFor: "Blinkit market share context", url: "https://m.economictimes.com/tech/technology/blinkit-tops-quick-commerce-with-over-50-market-share-set-to-gain-more-bofa/articleshow/124061833.cms" },
    { id: "reuters_zepto_2025", name: "Reuters — India's Zepto raises $450 million at $7 billion valuation", type: "B", usedFor: "Zepto funding and valuation context", url: "https://www.reuters.com/world/india/indian-quick-commerce-platform-zepto-raises-450-million-7-billion-valuation-2025-10-16/" },
    { id: "model_assumption", name: "Internal transparent model assumption", type: "D", usedFor: "City-language-category opportunity scores until replaced with live campaign or primary city data", url: "" }
  ]
};

const FALLBACK_SEED_DATA = {
  allowedLanguages: ["English", "Telugu", "Tamil", "Hindi", "Marathi", "Kannada", "Malayalam", "Odia", "Punjabi", "Haryanvi"],
  categories: ["Grocery", "Snacks & Beverages", "Dairy & Breakfast", "Personal Care", "Household Essentials", "Pet Food", "Beauty", "Baby Care", "Electronics Accessories"],
  weights: {
    quickCommerceDensity: 0.2,
    categoryPurchaseFrequency: 0.15,
    vernacularContentGap: 0.15,
    platformMaturity: 0.15,
    whatsappConversionFit: 0.1,
    creatorSupply: 0.1,
    paymentLogisticsReadiness: 0.1,
    competitiveGap: 0.05
  },
  cities: [
    { city: "Bengaluru", state: "Karnataka", languages: ["English", "Kannada", "Hindi"], quickCommerceDensity: 10, platformMaturity: 10, creatorSupply: 9, paymentLogisticsReadiness: 10, competitiveGap: 3, notes: "High-density quick-commerce market; strong control market for English and Kannada tests. Competitive gap is lower because saturation is high.", confidence: "D" },
    { city: "Hyderabad", state: "Telangana", languages: ["Telugu", "English", "Hindi"], quickCommerceDensity: 9, platformMaturity: 9, creatorSupply: 9, paymentLogisticsReadiness: 9, competitiveGap: 5, notes: "Strong Telugu + English quick-commerce wedge; useful for snack, grocery, beauty, and personal-care pilots.", confidence: "D" },
    { city: "Chennai", state: "Tamil Nadu", languages: ["Tamil", "English", "Hindi"], quickCommerceDensity: 9, platformMaturity: 9, creatorSupply: 8, paymentLogisticsReadiness: 9, competitiveGap: 5, notes: "Tamil-first market with strong urban quick-commerce relevance.", confidence: "D" },
    { city: "Pune", state: "Maharashtra", languages: ["Marathi", "English", "Hindi"], quickCommerceDensity: 9, platformMaturity: 9, creatorSupply: 8, paymentLogisticsReadiness: 9, competitiveGap: 5, notes: "High-income urban market; good for Marathi vs English conversion testing.", confidence: "D" },
    { city: "Gurgaon", state: "Haryana", languages: ["English", "Hindi", "Haryanvi"], quickCommerceDensity: 9, platformMaturity: 9, creatorSupply: 8, paymentLogisticsReadiness: 9, competitiveGap: 4, notes: "NCR-adjacent high-spend market. Haryanvi should be used carefully as cultural localization, not forced translation.", confidence: "D" },
    { city: "Vizag", state: "Andhra Pradesh", languages: ["Telugu", "English", "Hindi"], quickCommerceDensity: 7, platformMaturity: 7, creatorSupply: 7, paymentLogisticsReadiness: 8, competitiveGap: 7, notes: "Emerging Telugu quick-commerce market; useful for lower-competition pilots.", confidence: "D" },
    { city: "Coimbatore", state: "Tamil Nadu", languages: ["Tamil", "English"], quickCommerceDensity: 7, platformMaturity: 7, creatorSupply: 7, paymentLogisticsReadiness: 8, competitiveGap: 7, notes: "Tamil city cluster candidate. Avoid unsupported claim that zero Tamil digital marketing exists.", confidence: "D" },
    { city: "Nagpur", state: "Maharashtra", languages: ["Marathi", "Hindi", "English"], quickCommerceDensity: 7, platformMaturity: 7, creatorSupply: 6, paymentLogisticsReadiness: 8, competitiveGap: 7, notes: "Marathi/Hindi testing wedge for non-metro expansion.", confidence: "D" },
    { city: "Kochi", state: "Kerala", languages: ["Malayalam", "English", "Hindi"], quickCommerceDensity: 7, platformMaturity: 7, creatorSupply: 7, paymentLogisticsReadiness: 8, competitiveGap: 7, notes: "Malayalam market candidate for urban pocket testing.", confidence: "D" },
    { city: "Bhubaneswar", state: "Odisha", languages: ["Odia", "Hindi", "English"], quickCommerceDensity: 6, platformMaturity: 6, creatorSupply: 6, paymentLogisticsReadiness: 7, competitiveGap: 8, notes: "Emerging Odia test market; lower density but possibly less saturation.", confidence: "D" },
    { city: "Ludhiana", state: "Punjab", languages: ["Punjabi", "Hindi", "English"], quickCommerceDensity: 6, platformMaturity: 7, creatorSupply: 7, paymentLogisticsReadiness: 8, competitiveGap: 7, notes: "Punjabi premium/high-consumption pocket candidate.", confidence: "D" },
    { city: "Mysuru", state: "Karnataka", languages: ["Kannada", "English", "Hindi"], quickCommerceDensity: 6, platformMaturity: 6, creatorSupply: 6, paymentLogisticsReadiness: 7, competitiveGap: 8, notes: "Kannada expansion candidate after Bengaluru learning.", confidence: "D" }
  ],
  categoryScores: {
    "Grocery": { categoryPurchaseFrequency: 10, whatsappConversionFit: 8, risk: "Low differentiation; offer and delivery promise must be sharp." },
    "Snacks & Beverages": { categoryPurchaseFrequency: 9, whatsappConversionFit: 9, risk: "Highly impulse-driven; timing matters more than generic brand messaging." },
    "Dairy & Breakfast": { categoryPurchaseFrequency: 10, whatsappConversionFit: 8, risk: "Morning stock reliability matters; do not overpromise delivery slots." },
    "Personal Care": { categoryPurchaseFrequency: 7, whatsappConversionFit: 7, risk: "Needs trust and SKU clarity; avoid vague claims." },
    "Household Essentials": { categoryPurchaseFrequency: 8, whatsappConversionFit: 8, risk: "Urgency is real, but basket value can be low." },
    "Pet Food": { categoryPurchaseFrequency: 6, whatsappConversionFit: 7, risk: "Smaller audience; useful in high-income pin codes." },
    "Beauty": { categoryPurchaseFrequency: 6, whatsappConversionFit: 6, risk: "Needs influencer proof and product trust; high return/friction risk." },
    "Baby Care": { categoryPurchaseFrequency: 7, whatsappConversionFit: 8, risk: "High trust category; avoid aggressive discount-only copy." },
    "Electronics Accessories": { categoryPurchaseFrequency: 5, whatsappConversionFit: 6, risk: "Urgency-based but lower repeat rate." }
  }
};

// These global variables hold the data after loading.
let marketData = FALLBACK_MARKET_DATA;
let seedData = FALLBACK_SEED_DATA;
let selectedMetric = "gov";

// -----------------------------------------------------------------------------
// 2) SMALL HELPER FUNCTIONS
// -----------------------------------------------------------------------------

// This is a shortcut so we can write $("id") instead of document.getElementById("id").
function $(id) {
  return document.getElementById(id);
}

// Make big numbers easier to read in the dashboard.
function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value);
}

// Escape text before putting it into HTML. This prevents weird CSV text from breaking the page.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Try to load JSON from a file. If it fails, use fallback data.
async function loadJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("File not available");
    return await response.json();
  } catch (error) {
    console.warn(`Using fallback data for ${path}. Run with VS Code Live Server to load files directly.`);
    return fallback;
  }
}

// -----------------------------------------------------------------------------
// 3) SIMPLE SVG CHARTS
// -----------------------------------------------------------------------------
// No Chart.js. No internet. No dependencies. Just plain SVG bars.

function drawBarChart(containerId, data, options) {
  const container = $(containerId);
  const width = container.clientWidth || 600;
  const height = options.height || 280;
  const margin = { top: 24, right: 24, bottom: 54, left: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...data.map(d => d.value)) * 1.1;
  const barGap = 16;
  const barWidth = Math.max(20, (innerWidth - barGap * (data.length - 1)) / data.length);

  const bars = data.map((d, i) => {
    const x = margin.left + i * (barWidth + barGap);
    const barHeight = (d.value / maxValue) * innerHeight;
    const y = margin.top + innerHeight - barHeight;
    const label = options.prefix ? `${options.prefix}${formatNumber(d.value)}` : formatNumber(d.value);
    return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#232629"></rect>
      <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#151515">${label}</text>
      <text x="${x + barWidth / 2}" y="${height - 20}" text-anchor="middle" font-size="12" fill="#5f6673">${escapeHtml(d.period)}</text>
    `;
  }).join("");

  container.innerHTML = `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.title || "Bar chart")}">
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${width - margin.right}" y2="${margin.top + innerHeight}" stroke="#d7dce2" />
      ${bars}
      <text x="${margin.left}" y="18" font-size="12" fill="#5f6673">${escapeHtml(options.unit || "")}</text>
    </svg>
  `;
}

function drawLineChart(containerId, data, options) {
  const container = $(containerId);
  const width = container.clientWidth || 800;
  const height = options.height || 360;
  const margin = { top: 26, right: 34, bottom: 58, left: 68 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...data.map(d => d.value)) * 1.12;
  const minValue = Math.min(0, ...data.map(d => d.value));

  const points = data.map((d, i) => {
    const x = margin.left + (i / Math.max(1, data.length - 1)) * innerWidth;
    const y = margin.top + innerHeight - ((d.value - minValue) / (maxValue - minValue)) * innerHeight;
    return { ...d, x, y };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const circles = points.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="5" fill="#b11f2a"></circle>
    <text x="${p.x}" y="${p.y - 12}" text-anchor="middle" font-size="12" font-weight="700" fill="#151515">${options.valueFormatter(p.value)}</text>
    <text x="${p.x}" y="${height - 24}" text-anchor="middle" font-size="12" fill="#5f6673">${escapeHtml(p.period)}</text>
  `).join("");

  container.innerHTML = `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.title || "Line chart")}">
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${width - margin.right}" y2="${margin.top + innerHeight}" stroke="#d7dce2" />
      <path d="${path}" fill="none" stroke="#b11f2a" stroke-width="3"></path>
      ${circles}
      <text x="${margin.left}" y="18" font-size="12" fill="#5f6673">${escapeHtml(options.unit || "")}</text>
    </svg>
  `;
}

// -----------------------------------------------------------------------------
// 4) RENDER MARKET DATA
// -----------------------------------------------------------------------------

function renderKpis() {
  const sourceById = Object.fromEntries(marketData.sources.map(source => [source.id, source]));
  $("kpiGrid").innerHTML = marketData.kpis.map(kpi => `
    <div class="kpi-card">
      <div class="kpi-label">${escapeHtml(kpi.label)}</div>
      <div>
        <div class="kpi-value">${escapeHtml(kpi.value)}</div>
        <div class="kpi-caption">${escapeHtml(kpi.caption)}</div>
      </div>
      <div class="kpi-source">Confidence ${escapeHtml(sourceById[kpi.sourceId]?.type ?? "listed")}</div>
    </div>
  `).join("");
}

function renderMarketCharts() {
  drawBarChart("govChart", marketData.govSeries, {
    title: "India Q-commerce GOV",
    unit: "Gross order value, ₹ crore",
    prefix: "₹",
    height: 300
  });

  drawBarChart("darkStoreChart", marketData.darkStoreSeries, {
    title: "India dark stores",
    unit: "Number of dark stores",
    height: 300
  });

  renderInstamartChart();
}

function renderInstamartChart() {
  const labels = {
    gov: { unit: "GOV, ₹ crore", formatter: value => `₹${formatNumber(value)}` },
    orders: { unit: "Total orders, million", formatter: value => `${value}M` },
    mtu: { unit: "Average MTUs, million", formatter: value => `${value}M` },
    stores: { unit: "Active dark stores", formatter: value => formatNumber(value) },
    aov: { unit: "Average order value, ₹", formatter: value => `₹${formatNumber(value)}` }
  };

  const data = marketData.instamartSeries.map(row => ({ period: row.period, value: row[selectedMetric] }));
  drawLineChart("instamartChart", data, {
    title: "Swiggy Instamart quarterly operating metric",
    unit: labels[selectedMetric].unit,
    valueFormatter: labels[selectedMetric].formatter,
    height: 360
  });
}

// -----------------------------------------------------------------------------
// 5) CITY-LANGUAGE SCORER
// -----------------------------------------------------------------------------

function getSelectedCity() {
  return seedData.cities.find(c => c.city === $("citySelect").value) || seedData.cities[0];
}

function getSelectedCategory() {
  return seedData.categoryScores[$("categorySelect").value] || seedData.categoryScores[seedData.categories[0]];
}

function languageGapScore(language) {
  // This is an assumption score, not a public metric.
  // English gets lower gap because there is usually more English content.
  // Smaller vernacular pockets get higher gap because there may be less localized quick-commerce content.
  const scores = {
    English: 3,
    Hindi: 5,
    Telugu: 7,
    Tamil: 7,
    Marathi: 7,
    Kannada: 7,
    Malayalam: 7,
    Punjabi: 7,
    Odia: 8,
    Haryanvi: 8
  };
  return scores[language] || 5;
}

function calculateScore(city, language, categoryName) {
  const category = seedData.categoryScores[categoryName];
  const w = seedData.weights;
  const factors = {
    quickCommerceDensity: city.quickCommerceDensity,
    categoryPurchaseFrequency: category.categoryPurchaseFrequency,
    vernacularContentGap: languageGapScore(language),
    platformMaturity: city.platformMaturity,
    whatsappConversionFit: category.whatsappConversionFit,
    creatorSupply: city.creatorSupply,
    paymentLogisticsReadiness: city.paymentLogisticsReadiness,
    competitiveGap: city.competitiveGap
  };

  const weighted = Object.entries(factors).reduce((sum, [key, value]) => sum + value * w[key], 0);
  return {
    score: Math.round(weighted * 10),
    factors
  };
}

function verdictForScore(score) {
  if (score >= 82) return "Priority wedge: good enough for pilot planning.";
  if (score >= 72) return "Promising wedge: test with narrow budget and strong measurement.";
  if (score >= 62) return "Exploratory wedge: needs stronger proof before scaling.";
  return "Low-priority wedge: use as control or postpone.";
}

function populateControls() {
  $("citySelect").innerHTML = seedData.cities.map(c => `<option value="${escapeHtml(c.city)}">${escapeHtml(c.city)}</option>`).join("");
  $("categorySelect").innerHTML = seedData.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  $("categorySelect").value = "Snacks & Beverages";
  updateLanguageOptions();
}

function updateLanguageOptions() {
  const city = getSelectedCity();
  $("languageSelect").innerHTML = city.languages.map(lang => `<option value="${escapeHtml(lang)}">${escapeHtml(lang)}</option>`).join("");
}

function renderScore() {
  const city = getSelectedCity();
  const language = $("languageSelect").value;
  const categoryName = $("categorySelect").value;
  const category = getSelectedCategory();
  const result = calculateScore(city, language, categoryName);

  $("scoreValue").textContent = result.score;
  $("scoreVerdict").textContent = verdictForScore(result.score);
  $("wedgeTitle").textContent = `${city.city} × ${language} × ${categoryName}`;
  $("wedgeNarrative").textContent = `${city.notes} This wedge should be tested as a quick-commerce campaign, not claimed as proven until live experiment data is uploaded.`;

  const factorLabels = {
    quickCommerceDensity: "Q-commerce density",
    categoryPurchaseFrequency: "Purchase frequency",
    vernacularContentGap: "Content gap",
    platformMaturity: "Platform maturity",
    whatsappConversionFit: "WhatsApp fit",
    creatorSupply: "Creator supply",
    paymentLogisticsReadiness: "Payment/logistics readiness",
    competitiveGap: "Competitive gap"
  };

  $("scoreBreakdown").innerHTML = Object.entries(result.factors).map(([key, value]) => `
    <div class="breakdown-row">
      <div>
        <div style="font-size:13px; color:#5f6673; margin-bottom:5px;">${escapeHtml(factorLabels[key])}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${value * 10}%"></div></div>
      </div>
      <strong>${value}/10</strong>
    </div>
  `).join("");

  $("guardrails").innerHTML = [
    `Confidence level: ${city.confidence}. Treat as model assumption until validated.`,
    category.risk,
    `Native-language copy must be reviewed by a speaker before launch.`,
    `Do not claim CAC reduction until actual campaign spend and orders are imported.`
  ].map(text => `<div class="guardrail">${escapeHtml(text)}</div>`).join("");

  renderRankingTable();
  renderBrief();
  renderWhatsapp();
}

function allRankings() {
  const rankings = [];
  for (const city of seedData.cities) {
    for (const language of city.languages) {
      for (const category of seedData.categories) {
        const { score } = calculateScore(city, language, category);
        rankings.push({ city: city.city, state: city.state, language, category, score, confidence: city.confidence });
      }
    }
  }
  return rankings.sort((a, b) => b.score - a.score).slice(0, 12);
}

function renderRankingTable() {
  const rows = allRankings();
  $("rankingTable").innerHTML = `
    <table>
      <thead><tr><th>Rank</th><th>City</th><th>Language</th><th>Category</th><th>Score</th><th>Confidence</th></tr></thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(r.city)}, ${escapeHtml(r.state)}</td>
            <td>${escapeHtml(r.language)}</td>
            <td>${escapeHtml(r.category)}</td>
            <td><strong>${r.score}/100</strong></td>
            <td>${escapeHtml(r.confidence)} — model assumption</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// -----------------------------------------------------------------------------
// 6) CONTENT BRIEF + WHATSAPP FUNNEL
// -----------------------------------------------------------------------------

function renderBrief() {
  const city = getSelectedCity();
  const language = $("languageSelect").value;
  const categoryName = $("categorySelect").value;
  const { score } = calculateScore(city, language, categoryName);

  const brief = `QUICK-COMMERCE LOCAL CAMPAIGN BRIEF

Wedge
- City: ${city.city}, ${city.state}
- Language: ${language}
- Category: ${categoryName}
- Opportunity score: ${score}/100
- Confidence: ${city.confidence} — model assumption until campaign data is uploaded

Audience hypothesis
- High-density urban users inside serviceable quick-commerce pin codes.
- Purchase occasion should be urgent, frequent, or impulse-led.
- Do not treat this as a final ICP until experiment data confirms response.

Campaign angle
- Promise: fast local availability, not generic brand awareness.
- Hook: "Need ${categoryName.toLowerCase()} now? Get it delivered in minutes."
- Local layer: adapt references to ${city.city} neighborhoods, timing, weather, festivals, salary dates, cricket/events, and society/office routines.

Channel plan
1. WhatsApp broadcast or apartment-group seed
2. Instagram Reel / creator story
3. In-app banner or push notification
4. App deep link to category page

Measurement plan
- Primary KPI: first orders
- Secondary KPIs: CTR, app opens, add-to-cart rate, CAC, repeat orders within 7 days
- Compare against English control where possible

Guardrails
- Native-language copy must be reviewed by a speaker.
- Do not claim CAC reduction without spend and order data.
- Do not overpromise delivery time outside serviceable radius.
- Use source labels: public data for market context, model assumption for score, campaign CSV for performance.
`;

  $("briefOutput").textContent = brief;
}

function renderWhatsapp() {
  const city = getSelectedCity();
  const language = $("languageSelect").value;
  const categoryName = $("categorySelect").value;

  $("funnelTrigger").textContent = `${categoryName} need in ${city.city}: urgent, repeat, or impulse-led occasion.`;
  $("funnelOffer").textContent = `${city.city} pin-code offer with short expiry window and category deep link.`;

  const copy = `WHATSAPP FUNNEL TEMPLATE

Language target: ${language}
City: ${city.city}
Category: ${categoryName}

Important: This is a strategic copy skeleton. Translate/localize with a native speaker before launch.

Message 1 — Trigger
Need ${categoryName.toLowerCase()} quickly in ${city.city}? We are testing a local quick-commerce offer in your area today.

Message 2 — Offer
Order from the ${categoryName} collection and get delivery in the serviceable quick-commerce radius. Offer valid for selected pin codes only.

Message 3 — CTA
Tap here to open the app/category page: [ADD DEEP LINK]

Message 4 — Trust note
Only use this offer if your address is serviceable. Stock and delivery time can change by pin code.

Tracking tags
utm_source=whatsapp
utm_medium=hyperlocal
utm_campaign=${city.city.toLowerCase().replaceAll(" ", "_")}_${language.toLowerCase()}_${categoryName.toLowerCase().replaceAll(" ", "_").replaceAll("&", "and")}
`;

  $("whatsappOutput").textContent = copy;
}

// -----------------------------------------------------------------------------
// 7) SOURCES TABLE
// -----------------------------------------------------------------------------

function renderSources() {
  const confidence = {
    A: "Primary/company source",
    B: "Credible third-party source",
    C: "Vendor/case-study source",
    D: "Internal assumption/model layer"
  };

  $("sourceTable").innerHTML = `
    <table>
      <thead><tr><th>Source</th><th>Confidence</th><th>Used for</th><th>URL</th></tr></thead>
      <tbody>
        ${marketData.sources.map(s => `
          <tr>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${escapeHtml(s.type)} — ${escapeHtml(confidence[s.type] || "")}</td>
            <td>${escapeHtml(s.usedFor)}</td>
            <td>${s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noreferrer">Open source</a>` : "N/A"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// -----------------------------------------------------------------------------
// 8) CAMPAIGN CSV UPLOAD
// -----------------------------------------------------------------------------

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).filter(Boolean).map(line => {
    const values = line.split(",");
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]?.trim() ?? ""; });
    return row;
  });
}

function numberFrom(row, key) {
  return Number(row[key] || 0);
}

function renderCampaignData(rows) {
  if (!rows.length) return;

  $("campaignEmpty").classList.add("hidden");
  $("campaignDashboard").classList.remove("hidden");

  const totals = rows.reduce((acc, row) => {
    acc.spend += numberFrom(row, "spend_inr");
    acc.impressions += numberFrom(row, "impressions");
    acc.clicks += numberFrom(row, "clicks");
    acc.orders += numberFrom(row, "orders");
    acc.revenue += numberFrom(row, "revenue_inr");
    acc.repeatOrders += numberFrom(row, "repeat_orders_7d");
    return acc;
  }, { spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0, repeatOrders: 0 });

  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const cvr = totals.clicks ? (totals.orders / totals.clicks) * 100 : 0;
  const cac = totals.orders ? totals.spend / totals.orders : 0;
  const repeatRate = totals.orders ? (totals.repeatOrders / totals.orders) * 100 : 0;

  const kpis = [
    { label: "Total spend", value: `₹${formatNumber(Math.round(totals.spend))}`, caption: "Imported pilot data" },
    { label: "Orders", value: formatNumber(totals.orders), caption: "First-order conversions" },
    { label: "CTR", value: `${ctr.toFixed(2)}%`, caption: "Clicks / impressions" },
    { label: "CAC", value: totals.orders ? `₹${cac.toFixed(0)}` : "N/A", caption: "Spend / orders" },
    { label: "Revenue", value: `₹${formatNumber(Math.round(totals.revenue))}`, caption: "Imported campaign revenue" },
    { label: "CVR", value: `${cvr.toFixed(2)}%`, caption: "Orders / clicks" },
    { label: "7-day repeat rate", value: `${repeatRate.toFixed(1)}%`, caption: "Repeat orders / orders" },
    { label: "Rows imported", value: rows.length, caption: "Experiment count" }
  ];

  $("campaignKpis").innerHTML = kpis.map(kpi => `
    <div class="kpi-card">
      <div class="kpi-label">${escapeHtml(kpi.label)}</div>
      <div>
        <div class="kpi-value">${escapeHtml(kpi.value)}</div>
        <div class="kpi-caption">${escapeHtml(kpi.caption)}</div>
      </div>
    </div>
  `).join("");

  const chartRows = rows.map(row => ({ period: row.experiment_id, value: numberFrom(row, "orders") }));
  drawBarChart("campaignChart", chartRows, { title: "Orders by experiment", unit: "Orders", height: 300 });

  const ranked = [...rows].sort((a, b) => numberFrom(b, "orders") - numberFrom(a, "orders")).slice(0, 10);
  $("campaignTable").innerHTML = `
    <table>
      <thead><tr><th>Experiment</th><th>City</th><th>Language</th><th>Category</th><th>Spend</th><th>Orders</th><th>CAC</th></tr></thead>
      <tbody>
        ${ranked.map(row => {
          const orders = numberFrom(row, "orders");
          const spend = numberFrom(row, "spend_inr");
          return `
            <tr>
              <td>${escapeHtml(row.experiment_id)}</td>
              <td>${escapeHtml(row.city)}</td>
              <td>${escapeHtml(row.language)}</td>
              <td>${escapeHtml(row.category)}</td>
              <td>₹${formatNumber(spend)}</td>
              <td>${formatNumber(orders)}</td>
              <td>${orders ? `₹${Math.round(spend / orders)}` : "N/A"}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

// -----------------------------------------------------------------------------
// 9) EVENTS: WHAT HAPPENS WHEN USER CLICKS/CHANGES SOMETHING
// -----------------------------------------------------------------------------

// Keep navigation behavior in one place so top tabs and homepage CTA buttons
// reveal the same existing dashboard panels.
function showTab(tabId) {
  document.querySelectorAll(".tab").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  document.querySelectorAll(".panel").forEach(panel => {
    panel.classList.toggle("active-panel", panel.id === tabId);
  });
  renderMarketCharts();
}

function attachEvents() {
  document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
  });

  document.querySelectorAll(".jump-link").forEach(button => {
    button.addEventListener("click", () => {
      showTab(button.dataset.tab);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll(".mini-tab").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mini-tab").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      selectedMetric = button.dataset.metric;
      renderInstamartChart();
    });
  });

  $("citySelect").addEventListener("change", () => {
    updateLanguageOptions();
    renderScore();
  });

  $("languageSelect").addEventListener("change", renderScore);
  $("categorySelect").addEventListener("change", renderScore);

  $("copyBrief").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("briefOutput").textContent);
    $("copyBrief").textContent = "Copied";
    setTimeout(() => $("copyBrief").textContent = "Copy brief", 1200);
  });

  $("copyWhatsapp").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("whatsappOutput").textContent);
    $("copyWhatsapp").textContent = "Copied";
    setTimeout(() => $("copyWhatsapp").textContent = "Copy WhatsApp copy", 1200);
  });

  $("campaignUpload").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => renderCampaignData(parseCsv(e.target.result));
    reader.readAsText(file);
  });

  window.addEventListener("resize", () => {
    renderMarketCharts();
    renderScore();
  });
}

// -----------------------------------------------------------------------------
// 10) START THE DASHBOARD
// -----------------------------------------------------------------------------

async function init() {
  marketData = await loadJson("data/public_market_data.json", FALLBACK_MARKET_DATA);
  seedData = await loadJson("data/city_language_seed.json", FALLBACK_SEED_DATA);

  renderKpis();
  renderMarketCharts();
  populateControls();
  renderScore();
  renderSources();
  attachEvents();
}

init();
