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
let pilotCampaignUploaded = false;
let reportExportReady = false;

const PLATFORM_THEMES = {
  blinkit: {
    className: "blinkit",
    chartColor: "#111111",
    badge: "Reported market leader",
    posture: "Benchmark against the leader; avoid saturated wedges and find faster local demand pockets.",
    cues: ["10-min density", "Dark-store velocity", "Instant demand"]
  },
  instamart: {
    className: "instamart",
    chartColor: "#f36f21",
    badge: "Official public operating metrics available",
    posture: "Compare operating scale, store density, MTU growth, and category expansion before piloting.",
    cues: ["Store density", "MTU growth", "Category expansion"]
  },
  zepto: {
    className: "zepto",
    chartColor: "#6f2dbd",
    badge: "High-growth challenger",
    posture: "Study youth, impulse, and high-frequency growth without inferring campaign lift.",
    cues: ["Impulse growth", "Youthful wedge", "Fast cockpit"]
  },
  bigbasket_now: {
    className: "bigbasket_now",
    chartColor: "#145a32",
    badge: "Retail-backed grocery platform",
    posture: "Study grocery trust, replenishment behavior, and retail reliability; exact metrics need source.",
    cues: ["Grocery trust", "Basket depth", "Retail reliability"]
  },
  dunzo: {
    className: "dunzo",
    chartColor: "#4b4e52",
    badge: "Historical cautionary case",
    posture: "Study failure modes, operational sustainability, and unit-economics risks before scale.",
    cues: ["Historical case", "Risk review", "Unit economics"]
  }
};

const DEFAULT_PLATFORM_INTELLIGENCE = [
  {
    id: "blinkit",
    name: "Blinkit",
    currentRole: "Reported market leader.",
    publicMetrics: ["Market share: >50%"],
    strengths: ["Scale, dark-store density, high-frequency grocery behavior"],
    risks: ["Higher competitive saturation"],
    gtmImplication: "Use as benchmark, not entry wedge.",
    sourceQuality: "B",
    sourceNote: "Economic Times article citing BofA market-share context.",
    sourceId: "et_blinkit_2025"
  },
  {
    id: "zepto",
    name: "Zepto",
    currentRole: "High-growth quick-commerce challenger with sourced funding and valuation context.",
    publicMetrics: ["Valuation: $7B", "Funding round: $450M"],
    strengths: ["Strong youth and convenience positioning", "Useful benchmark for fast-moving challenger GTM"],
    risks: ["City-level operating metrics need source", "Funding strength is not proof of campaign efficiency"],
    gtmImplication: "Benchmark Zepto for urgency-led creative and youth-heavy city pockets; do not infer conversion rates without pilot data.",
    sourceQuality: "B",
    sourceNote: "Reuters funding and valuation article.",
    sourceId: "reuters_zepto_2025"
  },
  {
    id: "instamart",
    name: "Swiggy Instamart",
    currentRole: "Scaled quick-commerce platform.",
    publicMetrics: ["Q4FY25 GOV: INR 4,670 Cr", "Q4FY25 MTUs: 9.8M", "Q4FY25 AOV: INR 527", "Active dark stores: 1,021"],
    strengths: ["Official public operating metrics available"],
    risks: ["Expansion burn and profitability pressure"],
    gtmImplication: "Useful benchmark for store density and MTU growth.",
    sourceQuality: "A",
    sourceNote: "Swiggy Q4 FY2025 shareholder letter.",
    sourceId: "swiggy_q4fy25"
  },
  {
    id: "bigbasket_now",
    name: "BigBasket Now",
    currentRole: "Quick-commerce participant; exact public metrics are not loaded in this project.",
    publicMetrics: ["needs source"],
    strengths: ["Grocery trust and replenishment association", "Potential fit for planned basket and household categories"],
    risks: ["No sourced quick-commerce metrics currently loaded", "Needs separate source validation before benchmarking"],
    gtmImplication: "Use as a qualitative platform lens only until sourced public metrics are added.",
    sourceQuality: "D",
    sourceNote: "Needs source in this project file before public metric claims.",
    sourceId: "needs_source"
  },
  {
    id: "dunzo",
    name: "Dunzo - historical failure case",
    currentRole: "Historical cautionary case.",
    publicMetrics: ["needs source"],
    strengths: ["Early hyperlocal brand recall"],
    risks: ["Execution, funding, operational sustainability"],
    gtmImplication: "Do not copy growth without unit-economics guardrails.",
    sourceQuality: "D",
    sourceNote: "Historical failure framing is intentionally marked needs source for public claims.",
    sourceId: "needs_source"
  }
];

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

function selectedPlatform() {
  return getPlatformById($("platformSelect")?.value);
}

function selectedTheme() {
  const platform = selectedPlatform();
  return PLATFORM_THEMES[platform?.id] || PLATFORM_THEMES.blinkit;
}

function applyPlatformTheme() {
  const platform = selectedPlatform();
  const theme = selectedTheme();
  document.body.dataset.platform = theme.className;
  if ($("selectedPlatformName")) {
    $("selectedPlatformName").textContent = platform.name;
  }
  if ($("platformHeroBadge")) {
    $("platformHeroBadge").textContent = theme.badge;
  }
  if ($("platformGtmPosture")) {
    $("platformGtmPosture").textContent = theme.posture;
  }
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
  if (!container) return;
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
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${escapeHtml(options.color || "#232629")}"></rect>
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
  if (!container) return;
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
    <circle cx="${p.x}" cy="${p.y}" r="5" fill="${escapeHtml(options.color || "#b11f2a")}"></circle>
    <text x="${p.x}" y="${p.y - 12}" text-anchor="middle" font-size="12" font-weight="700" fill="#151515">${options.valueFormatter(p.value)}</text>
    <text x="${p.x}" y="${height - 24}" text-anchor="middle" font-size="12" fill="#5f6673">${escapeHtml(p.period)}</text>
  `).join("");

  container.innerHTML = `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.title || "Line chart")}">
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${width - margin.right}" y2="${margin.top + innerHeight}" stroke="#d7dce2" />
      <path d="${path}" fill="none" stroke="${escapeHtml(options.color || "#b11f2a")}" stroke-width="3"></path>
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

function listMarkup(items) {
  return `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function getPlatforms() {
  const allowed = ["blinkit", "instamart", "zepto", "bigbasket_now", "dunzo"];
  const platforms = marketData.platformIntelligence?.length ? marketData.platformIntelligence : DEFAULT_PLATFORM_INTELLIGENCE;
  return allowed.map(id => platforms.find(platform => platform.id === id)).filter(Boolean);
}

function getPlatformById(id) {
  return getPlatforms().find(platform => platform.id === id) || getPlatforms()[0];
}

function renderExecutiveRecommendations() {
  const top = allRankings()[0];
  const cards = [
    {
      label: "Best current wedge",
      value: top ? `${top.city} / ${top.language} / ${top.category}` : "Use the scorer to identify top city-language-category combinations.",
      note: "Generated from the transparent seed model."
    },
    {
      label: "Highest-risk assumption",
      value: "CAC and conversion uplift require live pilot data.",
      note: "No campaign performance is inferred."
    },
    {
      label: "Next experiment to run",
      value: "Run English vs vernacular content test using WhatsApp + Reels.",
      note: "Upload pilot CSV before reading performance."
    }
  ];

  $("recommendationStrip").innerHTML = cards.map(card => `
    <article class="recommendation-card">
      <p class="eyebrow">${escapeHtml(card.label)}</p>
      <strong>${escapeHtml(card.value)}</strong>
      <span>${escapeHtml(card.note)}</span>
    </article>
  `).join("");
}

function renderPlatformIntelligence() {
  applyPlatformTheme();
  const platform = selectedPlatform();
  $("platformIntelligence").innerHTML = `
    <div class="platform-title-row">
      <h3>${escapeHtml(platform.name)}</h3>
      <span class="confidence-badge">Confidence ${escapeHtml(platform.sourceQuality)}</span>
    </div>
    <div class="badge-row source-badge-row">
      <span class="confidence-badge">${escapeHtml(selectedTheme().badge)}</span>
      <span class="confidence-badge">Source: ${escapeHtml(sourceShortName(platform.sourceId))}</span>
      <span class="confidence-badge">Status: ${platform.sourceQuality === "D" ? "Needs source" : "Public data"}</span>
      <span class="confidence-badge">Pilot data: ${pilotCampaignUploaded ? "Uploaded" : "Not uploaded"}</span>
    </div>
    <div class="platform-cue-row">
      ${selectedTheme().cues.map(cue => `<span>${escapeHtml(cue)}</span>`).join("")}
    </div>
    <div class="platform-grid">
      <div><h4>Role</h4><p>${escapeHtml(platform.currentRole)}</p></div>
      <div><h4>Strength</h4><p>${escapeHtml(platform.strengths[0] || "Needs source")}</p></div>
      <div><h4>Risk</h4><p>${escapeHtml(platform.risks[0] || "Needs source")}</p></div>
      <div><h4>GTM implication</h4><p>${escapeHtml(platform.gtmImplication)}</p></div>
    </div>
    <div class="platform-metrics"><h4>Public metrics available</h4>${listMarkup(platform.publicMetrics)}</div>
    <div class="source-note"><strong>Source note:</strong> ${escapeHtml(platform.sourceNote)}</div>
  `;
}

function sourceShortName(sourceId) {
  const names = {
    careedge_2025: "CareEdge",
    swiggy_q4fy25: "Swiggy",
    et_blinkit_2025: "Economic Times / BofA",
    reuters_zepto_2025: "Reuters",
    needs_source: "Needs source",
    model_assumption: "Model assumption"
  };
  return names[sourceId] || sourceId || "Listed source";
}

function renderCampaignStatus() {
  const statuses = [
    { label: "Public data loaded", value: "Yes" },
    { label: "Competitor data loaded", value: "Partial / source-dependent" },
    { label: "Pilot campaign data uploaded", value: pilotCampaignUploaded ? "Yes" : "No" },
    { label: "Report export ready", value: reportExportReady ? "Yes" : "No" }
  ];

  $("campaignStatusPanel").innerHTML = statuses.map(item => `
    <div class="status-item">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("");

  $("pilotBadge").textContent = pilotCampaignUploaded ? "Pilot CSV uploaded" : "No pilot CSV";
  $("campaignStatusMessage").textContent = pilotCampaignUploaded
    ? "Pilot CSV is loaded. Campaign metrics are calculated from the uploaded file only."
    : "Campaign performance metrics are not yet available. Upload a real pilot CSV to calculate CTR, CAC, conversion rate, repeat order rate, and revenue.";
}

function renderMarketPulse() {
  const metric = $("marketMetricSelect").value;
  const view = $("marketViewSelect").value;
  const platform = selectedPlatform();
  const theme = selectedTheme();
  const platformLens = {
    blinkit: {
      insight: "Blinkit lens: market leadership makes it a benchmark, not automatically the easiest entry wedge.",
      soWhat: "A growth manager should avoid head-on saturation and test sharper local language/category pockets.",
      nextAction: "Run a vernacular first-order test in a less saturated city-language wedge."
    },
    instamart: {
      insight: "Instamart lens: official operating metrics make it the cleanest public benchmark in this dashboard.",
      soWhat: "A growth manager should use store density, MTU, and AOV context to shape category tests.",
      nextAction: "Run a store-density-aligned pilot for grocery, dairy, or snacks with clear repeat-order tracking."
    },
    zepto: {
      insight: "Zepto lens: challenger energy supports urgency-led creative, but platform-level metrics do not prove campaign lift.",
      soWhat: "A growth manager should test youth-heavy, impulse-led hooks before scaling spend.",
      nextAction: "Run an urgent Reels plus WhatsApp test for snacks, beverages, or personal care."
    },
    bigbasket_now: {
      insight: "BigBasket Now lens: grocery trust is useful, but exact quick-commerce metrics need source support.",
      soWhat: "A growth manager should treat it as a qualitative grocery-replenishment lens until sources are added.",
      nextAction: "Run a household replenishment hypothesis with clear serviceability and stock guardrails."
    },
    dunzo: {
      insight: "Dunzo lens: this is a historical cautionary case, not an active competitor benchmark.",
      soWhat: "A growth manager should not copy growth mechanics without unit-economics and operations guardrails.",
      nextAction: "Run a small pilot with strict CAC, repeat order, and serviceability gates before expansion."
    }
  }[platform.id];
  const configs = {
    gov: {
      data: marketData.govSeries,
      chart: "bar",
      unit: "Gross order value, INR crore",
      prefix: "INR ",
      headline: "Quick commerce is moving from convenience behavior to daily habit.",
      soWhat: "Prioritize high-frequency categories such as grocery, dairy, snacks, beverages, and personal care.",
      nextAction: "Run a city-language first-order test for a high-frequency category with WhatsApp plus Reels.",
      source: "CareEdge",
      confidence: "B",
      status: "Public data"
    },
    darkStores: {
      data: marketData.darkStoreSeries,
      chart: "bar",
      unit: "Number of dark stores",
      headline: "Infrastructure scale is becoming the operating moat.",
      soWhat: "Choose wedges inside serviceable pin codes and avoid promises that dark-store coverage cannot support.",
      nextAction: "Map the target offer to pin codes where delivery coverage and stock depth can support the claim.",
      source: "CareEdge",
      confidence: "B",
      status: "Public data"
    },
    instamartGov: {
      data: marketData.instamartSeries.map(row => ({ period: row.period, value: row.gov })),
      chart: "line",
      unit: "GOV, INR crore",
      formatter: value => `INR ${formatNumber(value)}`,
      headline: "Instamart shows the value of repeatable operating cadence.",
      soWhat: "Use platform operating data as context, not as proof that your campaign will convert.",
      nextAction: "Use Instamart as a benchmark and run your own measured campaign before claiming performance.",
      source: "Swiggy",
      confidence: "A",
      status: "Public data"
    },
    instamartMtu: {
      data: marketData.instamartSeries.map(row => ({ period: row.period, value: row.mtu })),
      chart: "line",
      unit: "Average MTUs, million",
      formatter: value => `${value}M`,
      headline: "Monthly transacting users are the clearest adoption signal in this data.",
      soWhat: "Design experiments around first order and repeat order behavior, then upload pilot results.",
      nextAction: "Run an English versus vernacular activation test and measure first order plus seven-day repeat.",
      source: "Swiggy",
      confidence: "A",
      status: "Public data"
    },
    instamartAov: {
      data: marketData.instamartSeries.map(row => ({ period: row.period, value: row.aov })),
      chart: "line",
      unit: "Average order value, INR",
      formatter: value => `INR ${formatNumber(value)}`,
      headline: "AOV context helps choose categories, but not creative winners.",
      soWhat: "Pair impulse categories with basket-builders and measure real order value from CSV data.",
      nextAction: "Test an offer that combines an urgent SKU with a basket-builder and track revenue from CSV.",
      source: "Swiggy",
      confidence: "A",
      status: "Public data"
    }
  };
  const viewNotes = {
    growth: "Market growth view: size the opportunity and prioritize high-frequency behavior.",
    infrastructure: "Operating infrastructure view: check whether serviceability can support the promise.",
    benchmark: "Platform benchmark view: compare against sourced public platform metrics only.",
    gtm: "GTM implication view: convert the market signal into a testable local experiment."
  };
  const config = configs[metric];

  $("marketInsightHeadline").textContent = `${config.headline} ${platformLens.insight}`;
  $("marketSoWhat").textContent = `${config.soWhat} ${platformLens.soWhat} ${viewNotes[view]}`;
  $("marketNextAction").textContent = platformLens.nextAction || config.nextAction;
  $("marketInsightBadges").innerHTML = `
    <span class="confidence-badge">Source: ${escapeHtml(config.source)}</span>
    <span class="confidence-badge">Confidence: ${escapeHtml(config.confidence)}</span>
    <span class="confidence-badge">Status: ${escapeHtml(config.status)}</span>
    <span class="confidence-badge">Pilot data: ${pilotCampaignUploaded ? "Uploaded" : "Not uploaded"}</span>
  `;

  if (config.chart === "bar") {
    drawBarChart("marketDynamicChart", config.data, { title: config.headline, unit: config.unit, prefix: config.prefix, height: 330, color: theme.chartColor });
  } else {
    drawLineChart("marketDynamicChart", config.data, { title: config.headline, unit: config.unit, valueFormatter: config.formatter, height: 330, color: theme.chartColor });
  }
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
  const platformOptions = getPlatforms().map(platform => `<option value="${escapeHtml(platform.id)}">${escapeHtml(platform.name)}</option>`).join("");
  $("platformSelect").innerHTML = platformOptions;
  $("scorerPlatformSelect").innerHTML = platformOptions;
  $("reportPlatformSelect").innerHTML = platformOptions;
  $("reportCitySelect").innerHTML = seedData.cities.map(c => `<option value="${escapeHtml(c.city)}">${escapeHtml(c.city)}</option>`).join("");
  $("reportCategorySelect").innerHTML = seedData.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  $("reportCategorySelect").value = "Snacks & Beverages";
  updateLanguageOptions();
  updateReportLanguageOptions();
}

function updateLanguageOptions() {
  const city = getSelectedCity();
  $("languageSelect").innerHTML = city.languages
    .filter(lang => seedData.allowedLanguages.includes(lang))
    .map(lang => `<option value="${escapeHtml(lang)}">${escapeHtml(lang)}</option>`)
    .join("");
}

function updateReportLanguageOptions() {
  const city = seedData.cities.find(c => c.city === $("reportCitySelect").value) || seedData.cities[0];
  $("reportLanguageSelect").innerHTML = city.languages
    .filter(lang => seedData.allowedLanguages.includes(lang))
    .map(lang => `<option value="${escapeHtml(lang)}">${escapeHtml(lang)}</option>`)
    .join("");
}

function renderScore() {
  const city = getSelectedCity();
  const language = $("languageSelect").value;
  const categoryName = $("categorySelect").value;
  const category = getSelectedCategory();
  const platform = getPlatformById($("scorerPlatformSelect").value);
  const objective = $("objectiveSelect").selectedOptions[0].textContent;
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
    for (const language of city.languages.filter(lang => seedData.allowedLanguages.includes(lang))) {
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
// 9) COMMAND-CENTER OVERRIDES AND REPORT GENERATOR
// -----------------------------------------------------------------------------
// These functions upgrade the original dashboard behavior while keeping the same
// element IDs, so the older charts and CSV upload continue to work.

function renderMarketCharts() {
  const theme = selectedTheme();
  drawBarChart("govChart", marketData.govSeries, {
    title: "India Q-commerce GOV",
    unit: "Gross order value, INR crore",
    prefix: "INR ",
    height: 300,
    color: theme.chartColor
  });

  drawBarChart("darkStoreChart", marketData.darkStoreSeries, {
    title: "India dark stores",
    unit: "Number of dark stores",
    height: 300,
    color: theme.chartColor
  });

  renderInstamartChart();
  if ($("marketDynamicChart")) renderMarketPulse();
}

function renderInstamartChart() {
  const theme = selectedTheme();
  const labels = {
    gov: { unit: "GOV, INR crore", formatter: value => `INR ${formatNumber(value)}` },
    orders: { unit: "Total orders, million", formatter: value => `${value}M` },
    mtu: { unit: "Average MTUs, million", formatter: value => `${value}M` },
    stores: { unit: "Active dark stores", formatter: value => formatNumber(value) },
    aov: { unit: "Average order value, INR", formatter: value => `INR ${formatNumber(value)}` }
  };

  const data = marketData.instamartSeries.map(row => ({ period: row.period, value: row[selectedMetric] }));
  drawLineChart("instamartChart", data, {
    title: "Swiggy Instamart quarterly operating metric",
    unit: labels[selectedMetric].unit,
    valueFormatter: labels[selectedMetric].formatter,
    height: 360,
    color: theme.chartColor
  });
}

function renderScore() {
  const city = getSelectedCity();
  const language = $("languageSelect").value;
  const categoryName = $("categorySelect").value;
  const category = getSelectedCategory();
  const platform = getPlatformById($("scorerPlatformSelect").value);
  const objective = $("objectiveSelect").selectedOptions[0].textContent;
  const result = calculateScore(city, language, categoryName);

  $("scoreValue").textContent = result.score;
  $("scoreVerdict").textContent = verdictForScore(result.score);
  $("wedgeTitle").textContent = `${city.city} / ${language} / ${categoryName} / ${platform.name}`;
  $("wedgeNarrative").textContent = `${city.notes} Objective: ${objective}. This wedge should be tested as a quick-commerce campaign, not claimed as proven until live experiment data is uploaded.`;

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

  $("attractiveReasons").innerHTML = [
    `Strongest factor: ${topFactors(result.factors, factorLabels)[0]}.`,
    `${categoryName} has a purchase-frequency score of ${category.categoryPurchaseFrequency}/10 in the seed model.`,
    `${platform.name} context: ${platform.gtmImplication}`
  ].map(text => `<div class="guardrail positive">${escapeHtml(text)}</div>`).join("");

  $("wedgeRisks").innerHTML = [
    category.risk,
    platform.risks[0],
    `Performance for ${objective.toLowerCase()} requires pilot CSV data.`
  ].map(text => `<div class="guardrail">${escapeHtml(text)}</div>`).join("");

  $("guardrails").innerHTML = [
    `Confidence level: ${city.confidence}. Treat as model assumption until validated.`,
    `Recommended first experiment: ${recommendedExperiment(language, categoryName, platform.name, objective)}.`,
    "Native-language copy must be reviewed by a speaker before launch."
  ].map(text => `<div class="guardrail">${escapeHtml(text)}</div>`).join("");

  renderRankingTable();
  renderReport();
  renderWhatsapp();
  renderExecutiveRecommendations();
}

function topFactors(factors, factorLabels) {
  return Object.entries(factors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, value]) => `${factorLabels[key]} (${value}/10)`);
}

function recommendedExperiment(language, categoryName, platformName, objective) {
  return `${platformName} ${objective.toLowerCase()} test for ${categoryName}: English control vs ${language} local creative across WhatsApp and Reels.`;
}

function selectedChannels() {
  return Array.from($("channelMixSelect").selectedOptions).map(option => option.value);
}

function getReportCity() {
  return seedData.cities.find(c => c.city === $("reportCitySelect").value) || seedData.cities[0];
}

function renderReport() {
  const city = getReportCity();
  const language = $("reportLanguageSelect").value || city.languages[0];
  const categoryName = $("reportCategorySelect").value;
  const platform = getPlatformById($("reportPlatformSelect").value);
  const objective = $("reportObjectiveSelect").selectedOptions[0].textContent;
  const audience = $("targetAudienceInput").value.trim() || "Urban quick-commerce users in serviceable pin codes";
  const offer = $("offerInput").value.trim() || "Pin-code limited launch offer with category deep link";
  const duration = $("durationInput").value.trim() || "14 days";
  const tone = $("toneSelect").value;
  const notes = $("reportNotesInput").value.trim() || "No additional manager notes.";
  const channels = selectedChannels();
  const { score } = calculateScore(city, language, categoryName);

  const report = `# Bharat Hyperlocal GTM Content Report

## A. Executive Summary
Platform: ${platform.name}
Market wedge: ${city.city}, ${language}, ${categoryName}
Objective: ${objective}
Opportunity score: ${score}/100
Confidence: ${city.confidence} - model assumption until pilot data is uploaded

This report converts public market context and the local scoring model into a 14-day GTM execution plan. It does not claim campaign performance results. CTR, CAC, conversion rate, repeat order rate, and revenue must come from a real uploaded pilot CSV.

## B. Market Audit
| Item | Readout |
| --- | --- |
| Public market context | Quick-commerce GOV, dark stores, and Instamart operating metrics are available in the project source file. |
| Platform benchmark | ${platform.currentRole} |
| Source quality | ${platform.sourceQuality} |
| Source note | ${platform.sourceNote} |

## C. ICP and Audience Hypothesis
Target audience: ${audience}

Hypothesis: users in serviceable ${city.city} pin codes will respond to ${tone} ${language} creative when the message is tied to a frequent or urgent ${categoryName.toLowerCase()} need.

## D. City-Language-Category Opportunity
| Dimension | Signal |
| --- | --- |
| City | ${city.city}, ${city.state} |
| Language | ${language} |
| Category | ${categoryName} |
| Platform | ${platform.name} |
| Model score | ${score}/100 |
| Notes | ${city.notes} |

## E. Campaign Strategy
Offer: ${offer}
Duration: ${duration}
Channel mix: ${channels.join(", ")}
Primary action: drive app/category-page visits and first measurable orders.

## F. 14-Day Content Calendar
| Days | Execution |
| --- | --- |
| 1-2 | Confirm serviceable pin codes, SKU availability, offer rules, and native-language review. |
| 3-4 | Produce English control and ${language} local variant for WhatsApp and short video. |
| 5-6 | Launch soft test to a narrow audience; check links, UTMs, and offer clarity. |
| 7 | Manager review: pause weak creatives, keep learnings qualitative until CSV data is uploaded. |
| 8-10 | Expand the best message angle to remaining selected channels. |
| 11-13 | Refresh urgency, trust, and local proof points without inventing results. |
| 14 | Export campaign CSV and review CTR, CAC, conversion rate, repeat order rate, and revenue. |

## G. WhatsApp Funnel
1. Trigger: urgent ${categoryName.toLowerCase()} need in ${city.city}.
2. Message: ${tone} ${language} copy reviewed by a native speaker.
3. Offer: ${offer}.
4. CTA: deep link to the category page with UTM tracking.
5. Follow-up: reminder only inside approved frequency and consent rules.

## H. Push Notification Plan
| Notification | Purpose |
| --- | --- |
| Launch | Announce local availability and offer. |
| Reminder | Reinforce urgency near the purchase occasion. |
| Trust | Clarify serviceability, stock, and delivery constraints. |

## I. Creator / Society Ambassador Brief
Ask creators or society ambassadors to show the real use case, not broad brand claims. The script should mention the city, category, offer boundary, and serviceable pin-code limitation.

## J. Intern Execution SOP
1. Confirm platform, city, language, category, offer, and duration with the manager.
2. Create English control and ${language} variant.
3. Add UTM tags before sharing.
4. Keep screenshots of every creative and message.
5. Upload only real pilot CSV data after launch.

## K. KPI Tracking Plan
| KPI | Source |
| --- | --- |
| CTR | Pilot CSV only |
| CAC | Pilot CSV only |
| Conversion rate | Pilot CSV only |
| Repeat order rate | Pilot CSV only |
| Revenue | Pilot CSV only |

## L. Risks and Guardrails
- Do not claim performance lift before pilot data is uploaded.
- Do not overpromise delivery time outside serviceable pin codes.
- Native-language copy requires review by a fluent speaker.
- ${platform.risks.join("\n- ")}

## M. Source and Assumption Notes
- Public market data source quality: see Sources tab.
- City-language score source quality: D, internal model assumption.
- Platform note: ${platform.sourceNote}
- Manager notes: ${notes}
`;

  $("briefOutput").textContent = report;
  reportExportReady = true;
  renderCampaignStatus();
}

function downloadReport() {
  const blob = new Blob([$("briefOutput").textContent], { type: "text/markdown" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "bharat-hyperlocal-gtm-report.md";
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderSources() {
  const confidence = {
    A: "Primary/company source",
    B: "Credible third-party source",
    C: "Vendor/case-study source",
    D: "Internal assumption / needs source"
  };
  const metrics = marketData.metricCatalog || marketData.kpis.map(kpi => ({
    metric: kpi.metric || kpi.label,
    value: kpi.value,
    sourceId: kpi.sourceId,
    dateOrYear: kpi.year || "Listed in project data",
    confidence: kpi.confidence || "Listed"
  }));

  $("sourceTable").innerHTML = `
    <h3>Public Metric Register</h3>
    <table>
      <thead><tr><th>Metric</th><th>Value</th><th>Source</th><th>Year</th><th>Confidence</th></tr></thead>
      <tbody>
        ${metrics.map(metric => `
          <tr>
            <td>${escapeHtml(metric.metric)}</td>
            <td><strong>${escapeHtml(metric.value)}</strong></td>
            <td>${escapeHtml(metric.sourceId)}</td>
            <td>${escapeHtml(metric.dateOrYear)}</td>
            <td>${escapeHtml(metric.confidence)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <h3 class="source-subhead">Source Directory</h3>
    <table>
      <thead><tr><th>Source</th><th>Confidence</th><th>Used for</th><th>Date/year</th><th>URL</th></tr></thead>
      <tbody>
        ${marketData.sources.map(s => `
          <tr>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${escapeHtml(s.type)} - ${escapeHtml(confidence[s.type] || "")}</td>
            <td>${escapeHtml(s.usedFor)}</td>
            <td>${escapeHtml(s.dateOrYear || "")}</td>
            <td>${s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noreferrer">Open source</a>` : "N/A"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
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
    { label: "Total spend", value: `INR ${formatNumber(Math.round(totals.spend))}`, caption: "Imported pilot data" },
    { label: "Orders", value: formatNumber(totals.orders), caption: "First-order conversions" },
    { label: "CTR", value: `${ctr.toFixed(2)}%`, caption: "Clicks / impressions" },
    { label: "CAC", value: totals.orders ? `INR ${cac.toFixed(0)}` : "N/A", caption: "Spend / orders" },
    { label: "Revenue", value: `INR ${formatNumber(Math.round(totals.revenue))}`, caption: "Imported campaign revenue" },
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
              <td>INR ${formatNumber(spend)}</td>
              <td>${formatNumber(orders)}</td>
              <td>${orders ? `INR ${Math.round(spend / orders)}` : "N/A"}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

// -----------------------------------------------------------------------------
// 10) EVENTS: WHAT HAPPENS WHEN USER CLICKS/CHANGES SOMETHING
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
  $("scorerPlatformSelect").addEventListener("change", renderScore);
  $("objectiveSelect").addEventListener("change", renderScore);
  $("platformSelect").addEventListener("change", () => {
    renderPlatformIntelligence();
    renderMarketPulse();
    renderMarketCharts();
  });
  $("marketMetricSelect").addEventListener("change", renderMarketPulse);
  $("marketViewSelect").addEventListener("change", renderMarketPulse);

  $("reportCitySelect").addEventListener("change", () => {
    updateReportLanguageOptions();
    renderReport();
  });
  $("reportLanguageSelect").addEventListener("change", renderReport);
  $("reportCategorySelect").addEventListener("change", renderReport);
  $("reportPlatformSelect").addEventListener("change", renderReport);
  $("reportObjectiveSelect").addEventListener("change", renderReport);
  $("targetAudienceInput").addEventListener("input", renderReport);
  $("offerInput").addEventListener("input", renderReport);
  $("durationInput").addEventListener("input", renderReport);
  $("channelMixSelect").addEventListener("change", renderReport);
  $("toneSelect").addEventListener("change", renderReport);
  $("reportNotesInput").addEventListener("input", renderReport);
  $("generateReport").addEventListener("click", renderReport);
  $("downloadReport").addEventListener("click", downloadReport);
  $("printReport").addEventListener("click", () => window.print());

  $("copyBrief").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("briefOutput").textContent);
    $("copyBrief").textContent = "Copied";
    setTimeout(() => $("copyBrief").textContent = "Copy Report", 1200);
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
    reader.onload = e => {
      pilotCampaignUploaded = true;
      renderCampaignData(parseCsv(e.target.result));
      renderCampaignStatus();
    };
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
  populateControls();
  renderPlatformIntelligence();
  renderMarketCharts();
  renderScore();
  renderCampaignStatus();
  renderMarketPulse();
  renderReport();
  renderSources();
  attachEvents();
}

init();
