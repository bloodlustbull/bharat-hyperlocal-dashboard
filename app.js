/*
  app.js is the dashboard brain.
  It loads local JSON files, applies platform themes, draws charts, and generates plans/reports.
*/

import { generateSeoBriefContent, renderSeoBrief, downloadSeoPdf } from "./seo-brief.js";

const FALLBACK_MARKET_DATA = { kpis: [], govSeries: [], darkStoreSeries: [], instamartSeries: [], metricCatalog: [], platformIntelligence: [], sources: [] };
const FALLBACK_SEED_DATA = { allowedLanguages: ["English", "Telugu", "Tamil", "Hindi", "Marathi", "Kannada", "Malayalam", "Odia", "Punjabi", "Haryanvi"], categories: ["Grocery"], cities: [], categoryScores: {}, weights: { quickCommerceDensity: 0.2, categoryPurchaseFrequency: 0.15, vernacularContentGap: 0.15, platformMaturity: 0.15, whatsappConversionFit: 0.1, creatorSupply: 0.1, paymentLogisticsReadiness: 0.1, competitiveGap: 0.05 } };

let marketData = FALLBACK_MARKET_DATA;
let seedData = FALLBACK_SEED_DATA;
let pilotCampaignUploaded = false;
let reportExportReady = false;
let lastReportMarkdown = "";
let lastReportHtml = "";
let caCsvData = null;
let caDraftData = null;
let caMetrics = null;
let caColumnMapping = null;
let priceWatchList = [];
let priceWatchLog = [];
let marketSignals = null;
let ragEvidenceLayer = null;
let geoLiveData = null;
let geoMapInstance = null;
let geoMapLoadedForCity = null;
let geoRefreshTimer = null;
let voiceRecognition = null;
let voiceListening = false;
let shellyStandby = false;
let shellySpeaking = false;
let shellyVoices = [];
let shellyStopAfterAnswer = false;

const PLATFORM_THEMES = {
  blinkit: {
    className: "blinkit",
    primary: "#f7c948",
    primaryDim: "rgba(247, 201, 72, 0.15)",
    primaryBorder: "rgba(247, 201, 72, 0.38)",
    glow: "rgba(247, 201, 72, 0.18)",
    textOnPrimary: "#1a1600",
    badge: "Reported market leader",
    posture: "Benchmark against the leader; avoid saturated wedges and find sharper local demand pockets."
  },
  instamart: {
    className: "instamart",
    primary: "#ff5722",
    primaryDim: "rgba(255, 87, 34, 0.14)",
    primaryBorder: "rgba(255, 87, 34, 0.38)",
    glow: "rgba(255, 87, 34, 0.16)",
    textOnPrimary: "#ffffff",
    badge: "Official public operating metrics available",
    posture: "Use operating scale and store-density metrics as a clean benchmark for local pilots."
  },
  zepto: {
    className: "zepto",
    primary: "#8b3cf7",
    primaryDim: "rgba(139, 60, 247, 0.16)",
    primaryBorder: "rgba(139, 60, 247, 0.4)",
    glow: "rgba(139, 60, 247, 0.18)",
    textOnPrimary: "#ffffff",
    badge: "High-growth challenger",
    posture: "Study youth, impulse, and high-frequency behavior without inferring campaign lift."
  },
  bigbasket_now: {
    className: "bigbasket_now",
    primary: "#22c55e",
    primaryDim: "rgba(34, 197, 94, 0.14)",
    primaryBorder: "rgba(239, 68, 68, 0.38)",
    glow: "rgba(34, 197, 94, 0.14)",
    textOnPrimary: "#ffffff",
    badge: "Retail-backed grocery platform",
    posture: "Study grocery trust and retail reliability; exact quick-commerce metrics need source."
  },
  dunzo: {
    className: "dunzo",
    primary: "#c58a1f",
    primaryDim: "rgba(197, 138, 31, 0.14)",
    primaryBorder: "rgba(197, 138, 31, 0.38)",
    glow: "rgba(197, 138, 31, 0.14)",
    textOnPrimary: "#ffffff",
    badge: "Historical cautionary case",
    posture: "Use as a post-mortem lens for operational sustainability and unit-economics risk."
  }
};

const PLATFORM_ORDER = ["blinkit", "instamart", "zepto", "bigbasket_now", "dunzo"];
const PLATFORM_LABELS = {
  blinkit: "Blinkit",
  instamart: "Swiggy Instamart",
  zepto: "Zepto",
  bigbasket_now: "BigBasket Now",
  dunzo: "Dunzo - historical failure case"
};

const CONFIDENCE_LABELS = {
  A: "Confidence: A - Verified primary source",
  B: "Confidence: B - Credible third-party source",
  C: "Confidence: C - Vendor / case-study source",
  D: "Confidence: D - Model assumption - requires validation"
};

const SOURCE_DISPLAY = {
  careedge_2025: "CareEdge Advisory",
  swiggy_q4fy25: "Swiggy Shareholder Letter FY25",
  et_blinkit_2025: "Economic Times",
  reuters_zepto_2025: "Global Newswire Source",
  model_assumption: "Internal transparent model",
  needs_source: "Needs source"
};

const BRAND_ICONS = {
  blinkit: {
    image: "assets/logos/blinkit.webp",
    gradient: "linear-gradient(135deg, #f7c948 0%, #e5a800 50%, #f7c948 100%)",
    glow: "rgba(247, 201, 72, 0.45)"
  },
  instamart: {
    image: "assets/logos/instamart.webp",
    gradient: "linear-gradient(135deg, #ff5722 0%, #e64a19 50%, #ff7043 100%)",
    glow: "rgba(255, 87, 34, 0.45)"
  },
  zepto: {
    image: "assets/logos/zepto.webp",
    gradient: "linear-gradient(135deg, #8b3cf7 0%, #7c2cf5 50%, #a855f7 100%)",
    glow: "rgba(139, 60, 247, 0.45)"
  },
  bigbasket_now: {
    image: "assets/logos/bigbasket.webp",
    gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #4ade80 100%)",
    glow: "rgba(34, 197, 94, 0.45)"
  },
  dunzo: {
    image: "assets/logos/dunzo.png",
    gradient: "linear-gradient(135deg, #c58a1f 0%, #a67518 50%, #daa544 100%)",
    glow: "rgba(197, 138, 31, 0.45)"
  }
};

const BM_DIMENSIONS = {
  blinkit: {
    dimensions: [
      { key: "scaleSignal", label: "Scale signal", score: 9, conf: "B", note: "Dominant market share (>50%)" },
      { key: "speedConvenience", label: "Speed / convenience", score: 9, conf: "B", note: "Speed-first positioning, 10-min delivery" },
      { key: "youthImpulse", label: "Youth / impulse fit", score: 7, conf: "C", note: "Broad convenience, not youth-specific" },
      { key: "groceryTrust", label: "Grocery trust", score: 9, conf: "B", note: "Category leader in grocery quick-commerce" }
    ],
    bestFit: "Use as benchmark for convenience-led, grocery-heavy campaigns in high-density markets.",
    learning: "Study speed-promise messaging and dark-store density strategy. Do not assume conversion without pilot data.",
    risk: "Higher competitive saturation in Blinkit-first cities.",
    evidenceConf: "B"
  },
  instamart: {
    dimensions: [
      { key: "scaleSignal", label: "Scale signal", score: 8, conf: "A", note: "1,021 stores, 9.8M MTUs, INR 4,670 Cr GOV" },
      { key: "speedConvenience", label: "Speed / convenience", score: 8, conf: "A", note: "Proven delivery scale with audited metrics" },
      { key: "youthImpulse", label: "Youth / impulse fit", score: 6, conf: "C", note: "Broad grocery, not youth-specific" },
      { key: "groceryTrust", label: "Grocery trust", score: 8, conf: "A", note: "Proven grocery replenishment platform" }
    ],
    bestFit: "Use as operating-scale benchmark for store density, AOV, and MTU growth campaigns.",
    learning: "Leverage audited public metrics to benchmark city-level density and AOV. Validate local assumptions before use.",
    risk: "Expansion burn and profitability pressure — do not assume unit economics transfer to your city.",
    evidenceConf: "A"
  },
  zepto: {
    dimensions: [
      { key: "scaleSignal", label: "Scale signal", score: 7, conf: "B", note: "$7B valuation, high-growth challenger" },
      { key: "speedConvenience", label: "Speed / convenience", score: 9, conf: "B", note: "10-min promise, urgency-led model" },
      { key: "youthImpulse", label: "Youth / impulse fit", score: 9, conf: "C", note: "Youth/impulse positioning, challenger energy" },
      { key: "groceryTrust", label: "Grocery trust", score: 6, conf: "C", note: "Convenience-first, not grocery-trust" }
    ],
    bestFit: "Use as youth/impulse positioning reference for challenger campaigns in urban pockets.",
    learning: "Benchmark urgency-led creative and youth-heavy city targets. Do not infer campaign efficiency from funding.",
    risk: "Funding strength is not proof of campaign efficiency; city-level operating metrics need source.",
    evidenceConf: "B"
  },
  bigbasket_now: {
    dimensions: [
      { key: "scaleSignal", label: "Scale signal", score: 5, conf: "D", note: "No public quick-commerce metrics in this project" },
      { key: "speedConvenience", label: "Speed / convenience", score: 6, conf: "D", note: "Planned-basket, not instant-first" },
      { key: "youthImpulse", label: "Youth / impulse fit", score: 4, conf: "D", note: "Replenishment, not impulse" },
      { key: "groceryTrust", label: "Grocery trust", score: 8, conf: "C", note: "Grocery trust and brand equity" }
    ],
    bestFit: "Use as a qualitative grocery-trust lens only — no sourced quick-commerce metrics available.",
    learning: "Study grocery replenishment brand equity; do not benchmark speed or impulse without pilot data.",
    risk: "No sourced public metrics — use as qualitative lens only until source-backed data is added.",
    evidenceConf: "D"
  },
  dunzo: {
    dimensions: [
      { key: "scaleSignal", label: "Scale signal", score: 2, conf: "D", note: "Historical case — no current scale" },
      { key: "speedConvenience", label: "Speed / convenience", score: 4, conf: "D", note: "Was early in delivery speed; failed to sustain" },
      { key: "youthImpulse", label: "Youth / impulse fit", score: 3, conf: "D", note: "Early urban adoption; not sustained" },
      { key: "groceryTrust", label: "Grocery trust", score: 3, conf: "D", note: "Brand recall fading; trust not proven at scale" }
    ],
    bestFit: "Use only as a cautionary post-mortem lens — not a growth benchmark.",
    learning: "Stress-test burn, operations, stock, attribution, and repeat economics before scaling any campaign.",
    risk: "Execution, funding, and operational sustainability — do not copy growth without unit-economics guardrails.",
    evidenceConf: "D"
  }
};

const CITY_PERSONA_MAP = {
  Hyderabad: {
    hook: "Ghar ka swad, quick-commerce speed.",
    priceAngle: "Value-conscious, mid-AOV households respond to simple savings and reliable replenishment.",
    topCategories: ["Snacks & Beverages", "Dairy & Breakfast", "Personal Care"],
    competitorGap: "Use local corridor tests around Kukatpally, Madhapur, and high-density apartment clusters before scaling.",
    localTrigger: "Biryani nights, cricket evenings, and late snack runs are useful demand windows."
  },
  Chennai: {
    hook: "Filter kaapi ready in minutes.",
    priceAngle: "Quality-first households may resist aggressive discount language; lead with freshness and trust.",
    topCategories: ["Grocery", "Dairy & Breakfast", "Household Essentials"],
    competitorGap: "Use challenger messaging in select residential catchments instead of broad city-wide claims.",
    localTrigger: "Morning tiffin and breakfast windows can anchor high-intent staple communication."
  },
  Bengaluru: {
    hook: "Office se ghar tak, essentials in minutes.",
    priceAngle: "Time-poor young professionals over-index on convenience, repeatability, and app-native offers.",
    topCategories: ["Snacks & Beverages", "Dairy & Breakfast", "Electronics Accessories"],
    competitorGap: "Avoid saturated central pockets for first tests; look for sharper wedges in north and east clusters.",
    localTrigger: "Evening commute and late workday top-ups are strong conversion-led windows."
  },
  Pune: {
    hook: "Kothrud se Kharadi tak, top-ups in minutes.",
    priceAngle: "Deal-aware families still respond to reliability and convenient weekly top-ups.",
    topCategories: ["Snacks & Beverages", "Household Essentials", "Dairy & Breakfast"],
    competitorGap: "Test catchment-level challenger wedges before broad metro-style media plans.",
    localTrigger: "Weekend grocery top-ups can drive higher basket size."
  },
  Vizag: {
    hook: "Beach city speed, home delivery ease.",
    priceAngle: "Mixed student and family audiences respond to practical convenience and reliability cues.",
    topCategories: ["Snacks & Beverages", "Dairy & Breakfast", "Grocery"],
    competitorGap: "Lower saturation means service reliability should be part of the message, not only discounts.",
    localTrigger: "Evening and weekend snacking windows are useful first tests."
  },
  Gurgaon: {
    hook: "From sector to society, essentials in minutes.",
    priceAngle: "High-spend apartment cohorts respond to speed, premium convenience, and clear value.",
    topCategories: ["Grocery", "Personal Care", "Household Essentials"],
    competitorGap: "Segment by society clusters; NCR-wide claims will be too blunt for action.",
    localTrigger: "Salary-week baskets, weekend family replenishment, and office-return windows are high intent."
  },
  Coimbatore: {
    hook: "Daily essentials, local comfort, quick delivery.",
    priceAngle: "Quality and reliability matter; avoid sounding like a metro-only discount blast.",
    topCategories: ["Grocery", "Dairy & Breakfast", "Household Essentials"],
    competitorGap: "Use Tamil-first cluster tests to find white space beyond Chennai-style assumptions.",
    localTrigger: "Breakfast staples and evening household top-ups are practical test windows."
  },
  Nagpur: {
    hook: "Family baskets and snack top-ups in minutes.",
    priceAngle: "Value-led households respond to pack-size clarity and sensible bundles.",
    topCategories: ["Snacks & Beverages", "Grocery", "Household Essentials"],
    competitorGap: "Lower quick-commerce clutter makes education and reliability cues more important.",
    localTrigger: "Weekend family baskets and evening snack windows are useful."
  },
  Kochi: {
    hook: "Fresh essentials, fast local delivery.",
    priceAngle: "Trust, freshness, and convenience should lead over heavy urgency.",
    topCategories: ["Grocery", "Personal Care", "Dairy & Breakfast"],
    competitorGap: "Malayalam-first communication can differentiate if service reliability is clear.",
    localTrigger: "Morning household needs and weekend replenishment are good starting points."
  },
  Bhubaneswar: {
    hook: "Local essentials at app speed.",
    priceAngle: "Emerging quick-commerce users need value and reliability explained plainly.",
    topCategories: ["Grocery", "Dairy & Breakfast", "Household Essentials"],
    competitorGap: "Lower platform saturation creates room to shape category behavior early.",
    localTrigger: "Evening top-ups and routine household replenishment can build habit."
  },
  Ludhiana: {
    hook: "Family basket ready, fast and local.",
    priceAngle: "Family-value messaging and bulk-friendly packs can work better than tiny discounts.",
    topCategories: ["Grocery", "Household Essentials", "Snacks & Beverages"],
    competitorGap: "Punjabi-localized pilots can stand out if they stay practical and not forced.",
    localTrigger: "Weekend family baskets and festival-prep windows are useful."
  },
  Mysuru: {
    hook: "Daily essentials with calm local convenience.",
    priceAngle: "Reliability, freshness, and sensible value are stronger than loud urgency.",
    topCategories: ["Grocery", "Dairy & Breakfast", "Personal Care"],
    competitorGap: "Kannada-first creative can test local trust against metro-style English copy.",
    localTrigger: "Morning staples and evening household top-ups are strong first tests."
  }
};

const VERNACULAR_PHRASE_BANK = {
  Telugu: {
    reviewed: true,
    greeting: "Namaskaram. Mee inti essentials minutes lo ready.",
    urgency: "Limited-time local offer.",
    value: "Fast delivery with clear savings today.",
    cta: "Order now"
  },
  Tamil: {
    reviewed: true,
    greeting: "Vanakkam. Ungal veettu essentials minutes-il ready.",
    urgency: "Limited-time local offer.",
    value: "Fast delivery with clear savings today.",
    cta: "Order now"
  },
  Hindi: {
    reviewed: false,
    greeting: "Namaste. Aapke ghar ke essentials minutes mein ready.",
    urgency: "Limited-time local offer.",
    value: "Fast delivery with clear savings today.",
    cta: "Order now"
  },
  Marathi: {
    reviewed: false,
    greeting: "Namaskar. Tumchya gharche essentials minutes madhye ready.",
    urgency: "Limited-time local offer.",
    value: "Fast delivery with clear savings today.",
    cta: "Order now"
  },
  Kannada: {
    reviewed: false,
    greeting: "Namaskara. Nimma mane essentials minutes nalli ready.",
    urgency: "Limited-time local offer.",
    value: "Fast delivery with clear savings today.",
    cta: "Order now"
  },
  Malayalam: {
    reviewed: false,
    greeting: "Namaskaram. Ningalude veetile essentials minutes-il ready.",
    urgency: "Limited-time local offer.",
    value: "Fast delivery with clear savings today.",
    cta: "Order now"
  },
  Odia: {
    reviewed: false,
    greeting: "Namaskar. Apananka ghara essentials minutes re ready.",
    urgency: "Limited-time local offer.",
    value: "Fast delivery with clear savings today.",
    cta: "Order now"
  },
  Punjabi: {
    reviewed: false,
    greeting: "Sat sri akaal. Tuhade ghar de essentials minutes vich ready.",
    urgency: "Limited-time local offer.",
    value: "Fast delivery with clear savings today.",
    cta: "Order now"
  },
  Haryanvi: {
    reviewed: false,
    greeting: "Ram Ram. Ghar ke essentials minutes mein ready.",
    urgency: "Limited-time local offer.",
    value: "Fast delivery with clear savings today.",
    cta: "Order now"
  }
};

const SIGNAL_ACTION_MAP = {
  "Product quality complaint": (city, category) => ({
    marketingRelevance: "MEDIUM",
    copyAction: `Avoid quality over-claims in ${city} ${category} copy until the issue is verified as fixed.`,
    channelAction: "Route the core issue to ops or QA; only test improvement messaging with small cohorts after resolution.",
    briefUpdate: `Quality complaints in ${city} for ${category}. Keep near-term copy factual and avoid unsupported quality claims.`
  }),
  "Packaging complaint": (city, category) => ({
    marketingRelevance: "MEDIUM",
    copyAction: `Avoid packaging-led visuals for ${category} in ${city}; lead with freshness, convenience, or availability instead.`,
    channelAction: "Share the signal with product and ops, then retest packaging-led copy after a fix is confirmed.",
    briefUpdate: `Packaging complaints in ${city} for ${category}. Avoid packaging as the primary creative hook.`
  }),
  'Value perception ("too expensive")': (city, category) => ({
    marketingRelevance: "HIGH",
    copyAction: `Lead with value-per-unit, pack-size, and basket-savings cues for ${category} in ${city}.`,
    channelAction: "A/B test bundle offers against value-led non-discount copy before scaling.",
    briefUpdate: `Price sensitivity signal in ${city} for ${category}. Recommend bundles, pack-size anchoring, or limited-time value communication.`
  }),
  "Taste/preference mismatch": (city, category) => ({
    marketingRelevance: "HIGH",
    copyAction: `Avoid generic authentic taste claims in ${city} ${category} copy; use familiar, local, or home-style language.`,
    channelAction: "Reduce broad push in affected pockets and test adjusted messaging with smaller cohorts.",
    briefUpdate: `Taste preference mismatch in ${city} for ${category}. Adjust hook, claims, and imagery before launch.`
  }),
  "Delivery issue (not marketing-relevant)": (city) => ({
    marketingRelevance: "LOW",
    copyAction: "Do not change top-of-funnel copy based only on last-mile issues.",
    channelAction: "Route to ops/logistics and make sure marketing promises match the real service level.",
    briefUpdate: `Delivery issues reported in ${city}. Treat as an operations input; keep marketing promises realistic.`
  }),
  "Positive signal - reorder intent": (city, category) => ({
    marketingRelevance: "HIGH",
    copyAction: `Lean into habit messaging for ${category} in ${city}: regulars, replenishment, and one-tap reorder.`,
    channelAction: "Trigger reminder flows, reorder nudges, and retention offers for high-intent cohorts.",
    briefUpdate: `Positive reorder intent in ${city} for ${category}. Add retention-led experiments to the brief.`
  })
};

let bmSelectedBrand = null;

function setSelectedBenchmark(brandId) {
  if (!BRAND_ICONS[brandId]) return;
  bmSelectedBrand = brandId;
  if ($("scorerPlatformSelect")) {
    $("scorerPlatformSelect").value = brandId;
  }
  if ($("platformSelect")) {
    $("platformSelect").value = brandId;
  }
  updateTheme(brandId);
  renderBenchmarkDetail(brandId);
  renderBenchmarkCockpit();
  renderScore();
}

function renderBenchmarkDetail(brandId) {
  const platform = getPlatforms().find(p => p.id === brandId);
  if (!platform) return;
  const icon = BRAND_ICONS[brandId] || BRAND_ICONS.blinkit;
  const dims = BM_DIMENSIONS[brandId];
  const sourceId = platform.sourceId || "needs_source";
  const source = (marketData.sources || []).find(s => s.id === sourceId);

  const imgHtml = icon.image
    ? `<img src="${icon.image}" alt="${escapeHtml(platform.name)}" style="width:40px;height:40px;object-fit:contain;position:relative;z-index:2;" onerror="this.style.display='none';var f=this.parentNode.querySelector('.bm-icon-missing');if(f)f.style.display='flex'" />`
    : "";

  const confLetter = dims ? dims.evidenceConf : platform.sourceQuality || "D";
  const confLabel = confLetter === "A" ? "A — Verified primary source" : confLetter === "B" ? "B — Credible third-party" : confLetter === "C" ? "C — Directional / partial" : "D — Assumption — needs validation";

  const dimsHtml = dims ? dims.dimensions.map(d => `
    <div class="bm-dim-row">
      <span class="bm-dim-label">${escapeHtml(d.label)}</span>
      <div class="bm-dim-bar-track"><div class="bm-dim-bar-fill ${d.score >= 7 ? "high" : d.score >= 5 ? "mid" : d.score >= 3 ? "low" : "very-low"}" style="width:${d.score * 10}%"></div></div>
      <span class="bm-dim-score">${d.score}/10</span>
      <span class="bm-dim-conf conf-${d.conf.toLowerCase()}">${d.conf}</span>
    </div>
  `).join("") : "";

  $("bmDetailPanel").innerHTML = `
    <div class="bm-detail-header">
      <div class="bm-detail-icon" style="background:${icon.gradient};">
        ${imgHtml}
        ${!icon.image ? '<span class="bm-icon-missing">Logo missing — add asset</span>' : '<span class="bm-icon-missing" style="display:none;">Logo missing</span>'}
        <div class="bm-icon-shine" aria-hidden="true"></div>
      </div>
      <div class="bm-detail-title">
        <h3>${escapeHtml(platform.name)}</h3>
        <span class="bm-detail-role">${escapeHtml(platform.currentRole)}</span>
      </div>
      <button class="bm-close-btn" id="bmCloseDetail" title="Close">&times;</button>
    </div>

    <div class="bm-detail-section">
      <div class="bm-detail-label">Best-fit use case</div>
      <div class="bm-detail-value">${escapeHtml(dims ? dims.bestFit : platform.gtmImplication)}</div>
    </div>

    <div class="bm-detail-section">
      <div class="bm-detail-label">What marketers can learn</div>
      <div class="bm-detail-value">${escapeHtml(dims ? dims.learning : platform.gtmImplication)}</div>
    </div>

    <div class="bm-detail-section">
      <div class="bm-detail-label">Risk / caveat</div>
      <div class="bm-detail-value risk">${escapeHtml(dims ? dims.risk : (platform.risks || []).join("; "))}</div>
    </div>

    <div class="bm-detail-section">
      <div class="bm-detail-label">Evidence confidence</div>
      <div class="bm-confidence-pill conf-${confLetter.toLowerCase()}">${escapeHtml(confLabel)}</div>
    </div>

    <div class="bm-detail-section">
      <div class="bm-detail-label">Source status</div>
      <div class="bm-detail-value">${source ? escapeHtml(source.name) : "Needs source"}</div>
    </div>

    ${dimsHtml ? `<div class="bm-detail-section"><div class="bm-detail-label">Dimensional framework</div>${dimsHtml}</div>` : ""}

    <div class="bm-detail-actions">
      <button class="primary-btn" id="bmEnterDashboard" data-brand="${brandId}">Enter Dashboard with this benchmark</button>
      <button class="bm-enter-btn" id="bmAddToBrief">Add to Campaign Brief</button>
      <button class="bm-enter-btn" id="bmViewEvidence">View Evidence</button>
    </div>
  `;

  $("bmDetailPanel").classList.remove("hidden");
  $("bmActionsBar").classList.remove("hidden");

  $("bmCloseDetail").addEventListener("click", () => {
    $("bmDetailPanel").classList.add("hidden");
    $("bmActionsBar").classList.add("hidden");
  });
  $("bmEnterDashboard").addEventListener("click", () => enterDashboard(brandId));
  $("bmAddToBrief").addEventListener("click", appendBenchmarkToBrief);
  $("bmViewEvidence").addEventListener("click", () => {
    setView("dashboardView");
    goToTab("market");
    setTimeout(() => {
      const el = $("benchmarkCockpit");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  });
}

function renderBenchmarkComparison() {
  const platforms = getPlatforms();
  const recommended = getRecommendedBenchmark();

  $("bmCompareGrid").innerHTML = platforms.map(platform => {
    const dims = BM_DIMENSIONS[platform.id];
    const icon = BRAND_ICONS[platform.id] || BRAND_ICONS.blinkit;
    const isRec = recommended?.id === platform.id;

    const imgHtml = icon.image
      ? `<img src="${icon.image}" alt="${escapeHtml(platform.name)}" style="width:26px;height:26px;object-fit:contain;position:relative;z-index:2;" onerror="this.style.display='none'" />`
      : "";

    const dimRows = dims ? dims.dimensions.map(d => `
      <div class="bm-dim-row">
        <span class="bm-dim-label">${escapeHtml(d.label)}</span>
        <div class="bm-dim-bar-track"><div class="bm-dim-bar-fill ${d.score >= 7 ? "high" : d.score >= 5 ? "mid" : d.score >= 3 ? "low" : "very-low"}" style="width:${d.score * 10}%"></div></div>
        <span class="bm-dim-score">${d.score}</span>
        <span class="bm-dim-conf conf-${d.conf.toLowerCase()}">${d.conf}</span>
      </div>
    `).join("") : "";

    return `
      <div class="bm-compare-card${isRec ? " bm-recommended" : ""}" data-platform="${platform.id}">
        <div class="bm-compare-brand">
          <div class="bm-compare-icon" style="background:${icon.gradient};">
            ${imgHtml}
            <div class="bm-icon-shine" aria-hidden="true"></div>
          </div>
          <span class="bm-compare-name">${escapeHtml(platform.name)}</span>
          <span class="bm-compare-conf bm-confidence-pill conf-${(dims ? dims.evidenceConf : platform.sourceQuality || "D").toLowerCase()}">${dims ? dims.evidenceConf : platform.sourceQuality || "D"}</span>
        </div>
        ${dimRows}
        <div class="bm-risk-tag">${escapeHtml(dims ? dims.risk : (platform.risks || []).join("; "))}</div>
      </div>
    `;
  }).join("");

  $("bmComparePanel").classList.remove("hidden");

  $("bmCompareGrid").querySelectorAll(".bm-compare-card").forEach(card => {
    card.addEventListener("click", () => {
      setSelectedBenchmark(card.dataset.platform);
      $("bmComparePanel").classList.add("hidden");
    });
  });
}

function getRecommendedBenchmark() {
  const city = cityFor("citySelect");
  const category = $("categorySelect")?.value || "Grocery";
  const language = $("languageSelect")?.value || "English";
  const platform = getPlatforms().find(p => p.id === (bmSelectedBrand || $("scorerPlatformSelect")?.value || "blinkit"));

  const highLang = ["Telugu", "Tamil", "Marathi", "Kannada", "Malayalam", "Odia", "Punjabi", "Haryanvi"].includes(language);
  const density = Number(city.quickCommerceDensity || 6);

  if (category === "Beauty" || (highLang && density >= 8)) return getPlatforms().find(p => p.id === "zepto") || platform;
  if (category === "Grocery" || category === "Dairy & Breakfast" || category === "Household Essentials") return getPlatforms().find(p => p.id === "blinkit") || platform;
  if (category === "Snacks & Beverages" || category === "Personal Care") return getPlatforms().find(p => p.id === "instamart") || platform;
  if (density <= 6) return getPlatforms().find(p => p.id === "instamart") || platform;
  return platform;
}

function renderBenchmarkRecommendation() {
  const recommended = getRecommendedBenchmark();
  if (!recommended) return;
  const dims = BM_DIMENSIONS[recommended.id];
  const icon = BRAND_ICONS[recommended.id];
  const city = cityFor("citySelect");
  const category = $("categorySelect")?.value || "Grocery";
  const language = $("languageSelect")?.value || "English";

  const reason = dims
    ? `${dims.bestFit} ${dims.learning}`
    : recommended.gtmImplication;

  const imgHtml = icon?.image
    ? `<div class="bm-cockpit-icon" style="background:${icon.gradient};"><img src="${icon.image}" alt="${escapeHtml(recommended.name)}" style="width:22px;height:22px;object-fit:contain;position:relative;z-index:2;" onerror="this.style.display='none'" /><div class="bm-icon-shine" aria-hidden="true"></div></div>`
    : "";

  $("bmRecommendation").innerHTML = `
    <div class="bm-rec-title">Recommended benchmark for ${escapeHtml(city.city || "selected city")} / ${escapeHtml(category)} / ${escapeHtml(language)}</div>
    <div class="bm-rec-brand">${imgHtml} ${escapeHtml(recommended.name)}</div>
    <p class="bm-rec-reason">${escapeHtml(reason)}</p>
    <div class="bm-rec-row">
      <span class="bm-rec-tag primary">Evidence: ${dims ? dims.evidenceConf : recommended.sourceQuality || "D"}</span>
      <span class="bm-rec-tag">Risk: ${escapeHtml(dims ? dims.risk : (recommended.risks || []).join("; "))}</span>
    </div>
  `;
}

function renderBenchmarkCockpit() {
  const platforms = getPlatforms();

  $("bmCockpitGrid").innerHTML = platforms.map(platform => {
    const dims = BM_DIMENSIONS[platform.id];
    const icon = BRAND_ICONS[platform.id] || BRAND_ICONS.blinkit;
    const isActive = bmSelectedBrand === platform.id;
    const confLetter = dims ? dims.evidenceConf : platform.sourceQuality || "D";

    const imgHtml = icon.image
      ? `<img src="${icon.image}" alt="${escapeHtml(platform.name)}" style="width:22px;height:22px;object-fit:contain;position:relative;z-index:2;" onerror="this.style.display='none'" />`
      : "";

    return `
      <div class="bm-cockpit-card${isActive ? " active" : ""}" data-platform="${platform.id}">
        <div class="bm-cockpit-brand">
          <div class="bm-cockpit-icon" style="background:${icon.gradient};">
            ${imgHtml}
            <div class="bm-icon-shine" aria-hidden="true"></div>
          </div>
          <span class="bm-cockpit-name">${escapeHtml(platform.name)}</span>
          <span class="bm-confidence-pill conf-${confLetter.toLowerCase()}">${confLetter}</span>
        </div>
        <p class="bm-cockpit-role">${escapeHtml(platform.currentRole)}</p>
      </div>
    `;
  }).join("");

  $("bmCockpitGrid").querySelectorAll(".bm-cockpit-card").forEach(card => {
    card.addEventListener("click", () => setSelectedBenchmark(card.dataset.platform));
  });

  renderBenchmarkRecommendation();
  renderBenchmarkCockpitEvidence();
}

function renderBenchmarkCockpitEvidence() {
  const brands = getPlatforms();
  const rows = [];

  brands.forEach(platform => {
    const sourceId = platform.sourceId || "needs_source";
    const source = (marketData.sources || []).find(s => s.id === sourceId);
    const dims = BM_DIMENSIONS[platform.id];
    const conf = dims ? dims.evidenceConf : platform.sourceQuality || "D";

    rows.push({
      source: source ? source.name : "Needs source — add to data",
      what: platform.publicMetrics.join("; "),
      confidence: conf,
      limitation: conf === "D" ? "Needs validation" : conf === "C" ? "Partial evidence" : ""
    });

    if (dims) {
      dims.dimensions.forEach(d => {
        if (d.conf === "D" || d.conf === "C") {
          rows.push({
            source: `${platform.name}: ${d.label}`,
            what: d.note,
            confidence: d.conf,
            limitation: d.conf === "D" ? "Model assumption — requires validation" : "Directional — partial evidence"
          });
        }
      });
    }
  });

  $("bmCockpitEvidence").innerHTML = `
    <div class="bm-cockpit-evidence-title">Evidence Ledger — all benchmarks</div>
    ${rows.map(r => `
      <div class="bm-evidence-row">
        <span class="bm-evidence-source">${escapeHtml(r.source)}</span>
        <span class="bm-evidence-what">${escapeHtml(r.what)}</span>
        <span class="bm-evidence-conf conf-${r.confidence.toLowerCase()}">${r.confidence}</span>
      </div>
    `).join("")}
  `;
}

function navigateOeStep(step) {
  renderOeTimeline(step);
  const selectorMap = {
    1: ".oe-command-panel",
    2: ".oe-score-card",
    3: "#benchmarkCockpit",
    4: ".oe-brief-card",
    5: "#campaign",
    6: "#oeLearningLoop"
  };
  const tabMap = { 1: "scorer", 2: "scorer", 3: "market", 4: "scorer", 5: "campaign", 6: "scorer" };
  const tab = tabMap[step];
  if (tab) goToTab(tab);
  const selector = selectorMap[step];
  if (!selector) return;
  const delay = tab ? 150 : 0;
  setTimeout(() => {
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (step === 1) {
      const citySelect = $("citySelect");
      if (citySelect) citySelect.focus();
    }
  }, delay);
}

function appendBenchmarkToBrief() {
  const brandId = bmSelectedBrand || $("scorerPlatformSelect")?.value || "blinkit";
  const platform = getPlatforms().find(p => p.id === brandId);
  const dims = BM_DIMENSIONS[brandId];
  if (!platform) return;

  const benchmarkText = `Benchmark lens: ${platform.name} — ${dims ? dims.bestFit : platform.gtmImplication}. Caveat: ${dims ? dims.risk : (platform.risks || []).join("; ")}.`;

  if (!window._oeBriefData) {
    generateBriefStatic();
  }

  window._oeBriefData.benchmarkLens = benchmarkText;
  window._oeBriefData.benchmarkConfidence = dims ? dims.evidenceConf : platform.sourceQuality || "D";
  const briefEl = $("oeBrief");
  if (briefEl && !briefEl.querySelector('[data-bm-lens]')) {
    briefEl.innerHTML += `<div class="oe-brief-field" data-bm-lens><div class="oe-brief-field-label">Benchmark lens</div><div class="oe-brief-field-value">${escapeHtml(benchmarkText)}</div></div>`;
  }

  const btn = $("bmAddToBrief");
  if (btn) {
    btn.textContent = "Added to brief";
    btn.disabled = true;
    setTimeout(() => { btn.textContent = "Add to Campaign Brief"; btn.disabled = false; }, 2500);
  }
}

function exportBenchmarkState() {
  const brandId = bmSelectedBrand || $("scorerPlatformSelect")?.value || "blinkit";
  const platform = getPlatforms().find(p => p.id === brandId);
  const dims = BM_DIMENSIONS[brandId];
  return {
    benchmarkId: brandId,
    benchmarkName: platform?.name || brandId,
    bestFit: dims?.bestFit || "",
    learning: dims?.learning || "",
    risk: dims?.risk || "",
    evidenceConfidence: dims?.evidenceConf || platform?.sourceQuality || "D",
    dimensions: dims?.dimensions || []
  };
}

function resetBenchmarkView() {
  const startScreen = $("benchmarkStart");
  const orbit = $("brandOrbit");
  const detailPanel = $("bmDetailPanel");
  const comparePanel = $("bmComparePanel");
  const actionsBar = $("bmActionsBar");

  if (detailPanel) detailPanel.classList.add("hidden");
  if (comparePanel) comparePanel.classList.add("hidden");
  if (actionsBar) actionsBar.classList.add("hidden");

  if (startScreen && orbit) {
    orbit.classList.add("hidden");
    orbit.querySelectorAll(".brand-orbit-item").forEach(item => item.classList.remove("visible"));
    startScreen.classList.remove("hidden", "exiting");
  }
}

const ORBIT_POSITIONS = [
  { angle: -90, distance: 0.34 },   // top
  { angle: -10, distance: 0.34 },   // top-right
  { angle: 62, distance: 0.34 },    // bottom-right
  { angle: 142, distance: 0.34 },   // bottom-left
  { angle: 218, distance: 0.34 }    // top-left
];

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value);
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(path);
    return await response.json();
  } catch {
    return fallback;
  }
}

function getBackendApiBase() {
  return (localStorage.getItem("bharatRagApiUrl") || "http://127.0.0.1:8787").replace(/\/+$/, "") + "/api";
}

async function postBackend(endpoint, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${getBackendApiBase()}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
      showToast("warn", `Rate limited by backend. Retry in ${retryAfter}s`);
      throw new Error(`Rate limited (retry in ${retryAfter}s)`);
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Backend ${endpoint} failed: ${response.status} ${text}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function platformPayloadValue(platform) {
  return platform?.id || platform?.name || "blinkit";
}

function getPlatforms() {
  const fromData = marketData.platformIntelligence?.length ? marketData.platformIntelligence : [];
  return PLATFORM_ORDER.map(id => fromData.find(platform => platform.id === id) || {
    id,
    name: PLATFORM_LABELS[id],
    currentRole: id === "dunzo" ? "Historical cautionary case only." : "Awaiting public source",
    publicMetrics: ["Awaiting public source"],
    strengths: ["Awaiting public source"],
    risks: ["Awaiting public source"],
    gtmImplication: "Awaiting public source",
    sourceQuality: "D",
    sourceNote: "Awaiting public source",
    sourceId: "needs_source"
  });
}

function selectedPlatform() {
  return getPlatforms().find(platform => platform.id === $("platformSelect")?.value) || getPlatforms()[0];
}

function setView(viewId) {
  ["landingView", "brandMapView", "dashboardView"].forEach(id => {
    const view = $(id);
    if (!view) return;
    view.style.display = "";
    view.classList.toggle("view-active", id === viewId);
  });
}

function showLanding() {
  setView("landingView");
}

function showBrandMap() {
  $("three-overlay")?.classList.add("hidden");
  $("three-container")?.classList.add("hidden");
  $("brand-hint")?.classList.add("hidden");
  setView("brandMapView");
  const startScreen = $("benchmarkStart");
  const orbit = $("brandOrbit");
  if (startScreen && orbit) {
    startScreen.classList.remove("hidden", "exiting");
    orbit.classList.add("hidden");
    orbit.querySelectorAll(".brand-orbit-item").forEach(item => item.classList.remove("visible"));
  }
  if ($("bmDetailPanel")) $("bmDetailPanel").classList.add("hidden");
  if ($("bmComparePanel")) $("bmComparePanel").classList.add("hidden");
  if ($("bmActionsBar")) $("bmActionsBar").classList.add("hidden");
}

function goToTab(tabName) {
  document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tabName));
  document.querySelectorAll(".panel").forEach(panel => panel.classList.toggle("active-panel", panel.id === tabName));
  if (tabName === "market") renderMarketPulse();
  if (tabName === "scorer") renderScore();
  if (tabName === "campaign") renderCampaignAutopilot();
  if (tabName === "video") renderVideoCampaignStudio();
  if (tabName === "geo") renderGeoSalesCommandCenter();
  if (tabName === "rag") renderRagLayer();
  if (tabName === "pricewatch") {
    populatePriceWatchControls();
    renderPriceWatchTable();
    renderPriceWatchAlerts();
    renderPriceWatchTrend();
  }
  if (tabName === "pipeline") renderPipelineTab();
  if (tabName === "observability") startObservabilityLoop();
  else stopObservabilityLoop();
}

function enterDashboard(platformId) {
  bmSelectedBrand = platformId;
  setActivePlatform(platformId);
  setView("dashboardView");
  goToTab("market");
}

function updateTheme(platformId) {
  const theme = PLATFORM_THEMES[platformId] || PLATFORM_THEMES.blinkit;
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", theme.primary);
  root.style.setProperty("--theme-primary-dim", theme.primaryDim);
  root.style.setProperty("--theme-primary-border", theme.primaryBorder);
  root.style.setProperty("--theme-glow", theme.glow);
  root.style.setProperty("--theme-text-on-primary", theme.textOnPrimary);
  document.body.dataset.platform = theme.className;

  document.querySelectorAll(".platform-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.platform === platformId);
  });

  const platform = getPlatforms().find(item => item.id === platformId) || getPlatforms()[0];
  $("selectedPlatformName").textContent = platform.name;
  $("platformHeroBadge").textContent = theme.badge;
  $("platformGtmPosture").textContent = theme.posture;
}

function setActivePlatform(platformId) {
  if ($("platformSelect")) $("platformSelect").value = platformId;
  ["scorerPlatformSelect", "plannerPlatformSelect", "reportPlatformSelect", "videoPlatformSelect"].forEach(id => {
    if ($(id)) $(id).value = platformId;
  });
  updateTheme(platformId);
  updatePlatformPanels();
}

function updatePlatformPanels() {
  renderPlatformIntelligence();
  renderMarketPulse();
  renderKpis();
  renderScore();
  renderExperimentPlan();
  renderReport();
  renderBenchmarkCockpit();
  renderVideoCampaignStudio();
  renderGeoSalesCommandCenter();
}

function sourceById(id) {
  return (marketData.sources || []).find(source => source.id === id);
}

function metricByText(text) {
  const needle = text.toLowerCase();
  return (marketData.metricCatalog || []).find(item => item.metric.toLowerCase().includes(needle));
}

function sourceLabel(sourceId) {
  return sourceLabelReadable(sourceId);
}

function confidenceText(label) {
  return CONFIDENCE_LABELS[label] || "Confidence: needs validation";
}

function sourceLabelReadable(sourceId) {
  const source = sourceById(sourceId);
  if (!source) return "Needs source";
  const display = SOURCE_DISPLAY[sourceId] || source.name;
  return `${display} · ${confidenceText(source.type)}`;
}

function populatePlatformControls() {
  const platforms = getPlatforms();
  const options = platforms.map(platform => `<option value="${platform.id}">${escapeHtml(platform.name)}</option>`).join("");
  ["platformSelect", "scorerPlatformSelect", "plannerPlatformSelect", "reportPlatformSelect", "videoPlatformSelect"].forEach(id => {
    if ($(id)) $(id).innerHTML = options;
  });
  $("platformButtons").innerHTML = platforms.map(platform => `
    <button class="platform-btn" type="button" data-platform="${platform.id}">${escapeHtml(platform.name)}</button>
  `).join("");
  renderBrandTiles();
}

function renderBrandTiles() {
  const platforms = getPlatforms();
  const container = $("brandTileGrid");
  if (!container) return;

  container.innerHTML = platforms.map((platform, index) => {
    const icon = BRAND_ICONS[platform.id] || BRAND_ICONS.blinkit;
    const pos = ORBIT_POSITIONS[index] || ORBIT_POSITIONS[0];
    const isD = platform.sourceQuality === "D";
    const confClass = isD ? "assumption" : "verified";
    return `
      <button class="brand-orbit-item" data-platform="${platform.id}" data-index="${index}"
        style="--icon-glow:${icon.glow};--float-delay:${index * 0.7}s;left:50%;top:50%;">
        <div class="orbit-icon-wrap">
          <div class="orbit-icon" style="background:${icon.gradient};">
            <img src="${icon.image}" alt="${escapeHtml(platform.name)}" class="orbit-logo" onerror="this.style.display='none'" />
            <div class="orbit-icon-shine" aria-hidden="true"></div>
          </div>
          <span class="orbit-confidence ${confClass}"></span>
        </div>
        <span class="orbit-label">${escapeHtml(platform.name)}</span>
      </button>
    `;
  }).join("");

  container.querySelectorAll(".brand-orbit-item").forEach((item, index) => {
    const pos = ORBIT_POSITIONS[index];
    item.dataset.left = `${50 + pos.distance * 100 * Math.cos(pos.angle * Math.PI / 180)}%`;
    item.dataset.top = `${50 + pos.distance * 100 * Math.sin(pos.angle * Math.PI / 180)}%`;
  });
}

function animateBenchmarkReveal() {
  const items = document.querySelectorAll(".brand-orbit-item");
  items.forEach((item, index) => {
    const left = item.dataset.left;
    const top = item.dataset.top;
    item.style.left = left;
    item.style.top = top;
    setTimeout(() => {
      item.classList.add("visible");
    }, 120 + index * 140);
  });
}

function startBenchmark() {
  const startScreen = $("benchmarkStart");
  const orbit = $("brandOrbit");
  if (!startScreen || !orbit) return;
  startScreen.classList.add("exiting");
  setTimeout(() => {
    startScreen.classList.add("hidden");
    orbit.classList.remove("hidden");
    animateBenchmarkReveal();
  }, 400);
}

function populateSeedControls() {
  const cities = seedData.cities || [];
  const categories = seedData.categories || [];
  const cityOptions = cities.map(city => `<option value="${escapeHtml(city.city)}">${escapeHtml(city.city)}</option>`).join("");
  const categoryOptions = categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  ["citySelect", "plannerCitySelect", "reportCitySelect", "videoCitySelect", "geoCitySelect"].forEach(id => { if ($(id)) $(id).innerHTML = cityOptions; });
  ["categorySelect", "plannerCategorySelect", "reportCategorySelect", "videoCategorySelect"].forEach(id => { if ($(id)) $(id).innerHTML = categoryOptions; });
  updateLanguageOptions("citySelect", "languageSelect");
  updateLanguageOptions("plannerCitySelect", "plannerLanguageSelect");
  updateLanguageOptions("reportCitySelect", "reportLanguageSelect");
  updateLanguageOptions("videoCitySelect", "videoLanguageSelect");
}

function cityFor(selectId) {
  return (seedData.cities || []).find(city => city.city === $(selectId)?.value) || seedData.cities?.[0] || {};
}

function updateLanguageOptions(citySelectId, languageSelectId) {
  const city = cityFor(citySelectId);
  const languages = (city.languages || [city.language || "English"]).filter(lang => (seedData.allowedLanguages || []).includes(lang));
  if ($(languageSelectId)) {
    const prevLang = $(languageSelectId).value;
    $(languageSelectId).innerHTML = languages.map(lang => `<option>${escapeHtml(lang)}</option>`).join("");
    if (prevLang && languages.includes(prevLang)) {
      $(languageSelectId).value = prevLang;
    }
  }
}

function categoryProfile(categoryName) {
  return seedData.categoryScores?.[categoryName] || { categoryPurchaseFrequency: 6, whatsappConversionFit: 6, risk: "Category benchmark requires independent source." };
}

function languageGapScore(language) {
  const scores = { English: 3, Hindi: 5, Telugu: 7, Tamil: 7, Marathi: 7, Kannada: 7, Malayalam: 7, Punjabi: 7, Odia: 8, Haryanvi: 8 };
  return scores[language] || 5;
}

function calculateScore(city, language, categoryName, platformOverride) {
  const category = categoryProfile(categoryName);
  const factors = {
    quickCommerceDensity:    Number(city.quickCommerceDensity || 6),
    categoryPurchaseFrequency: category.categoryPurchaseFrequency,
    vernacularContentGap:    languageGapScore(language),
    platformMaturity:        Number(city.platformMaturity || 6),
    whatsappConversionFit:   category.whatsappConversionFit,
    creatorSupply:           Number(city.creatorSupply || 6),
    paymentLogisticsReadiness: Number(city.paymentLogisticsReadiness || 6),
    competitiveGap:           Number(city.competitiveGap || 6)
  };
  const weights = seedData.weights || {};
  const weighted = Object.entries(factors).reduce(
    (sum, [key, value]) => sum + value * (weights[key] || 0.125), 0
  );
  const rawScore = Math.round(weighted * 10);
  const platform = platformOverride || (document.getElementById("scorerPlatformSelect") ? getPlatforms().find(item => item.id === $("scorerPlatformSelect").value) || selectedPlatform() : selectedPlatform());
  const confidence = oeConfidenceLevel(city, platform);
  const confMultiplier = { A: 1, B: 0.95, C: 0.85, D: 0.7 }[confidence] || 0.7;
  const adjustedScore = Math.round(rawScore * confMultiplier);
  return { score: adjustedScore, rawScore, factors, confidence };
}

const OE_PILLARS = [
  { key: "demandSignal", label: "Demand signal", weight: 0.30, factorKeys: ["quickCommerceDensity", "categoryPurchaseFrequency"] },
  { key: "platformFit", label: "Platform / benchmark fit", weight: 0.20, factorKeys: ["platformMaturity", "creatorSupply"] },
  { key: "languageFit", label: "Language-local fit", weight: 0.20, factorKeys: ["vernacularContentGap", "whatsappConversionFit"] },
  { key: "competition", label: "Competition / whitespace", weight: 0.15, factorKeys: ["competitiveGap", "paymentLogisticsReadiness"] },
  { key: "evidenceConf", label: "Evidence confidence", weight: 0.15, factorKeys: [] }
];

const OE_FACTOR_LABELS = {
  quickCommerceDensity: "Quick-commerce density",
  categoryPurchaseFrequency: "Category purchase frequency",
  vernacularContentGap: "Vernacular content gap",
  platformMaturity: "Platform maturity",
  whatsappConversionFit: "WhatsApp conversion fit",
  creatorSupply: "Creator supply",
  paymentLogisticsReadiness: "Payment/logistics readiness",
  competitiveGap: "Competitive gap"
};

const OE_WEIGHT_LABELS = {
  quickCommerceDensity: "20%",
  categoryPurchaseFrequency: "15%",
  vernacularContentGap: "15%",
  platformMaturity: "15%",
  whatsappConversionFit: "10%",
  creatorSupply: "10%",
  paymentLogisticsReadiness: "10%",
  competitiveGap: "5%"
};

function oeConfidenceLevel(city, platform) {
  const cityConf = city.confidence || "D";
  const platConf = platform.sourceQuality || "D";
  const levels = { A: 4, B: 3, C: 2, D: 1 };
  const minLevel = Math.min(levels[cityConf] || 1, levels[platConf] || 1);
  return minLevel >= 4 ? "A" : minLevel >= 3 ? "B" : minLevel >= 2 ? "C" : "D";
}

function oePillarScores(factors, confidence) {
  const confMultiplier = { A: 1, B: 0.95, C: 0.85, D: 0.7 }[confidence] || 0.7;
  return OE_PILLARS.map(pillar => {
    let raw;
    if (pillar.key === "evidenceConf") {
      raw = { A: 9, B: 7, C: 5, D: 3 }[confidence] || 3;
    } else {
      const vals = pillar.factorKeys.map(k => factors[k] || 5);
      raw = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    const adjusted = Math.round(raw * confMultiplier * 10) / 10;
    return { ...pillar, raw: Math.round(raw * 10) / 10, adjusted, weighted: Math.round(adjusted * pillar.weight * 10) / 10 };
  });
}

function oeRecommendation(city, language, category, platform, objective, channel, score, pillars) {
  const topPillar = [...pillars].sort((a, b) => b.adjusted - a.adjusted)[0];
  const weakPillar = [...pillars].sort((a, b) => a.adjusted - b.adjusted)[0];
  const cityName = city.city || "Selected city";
  const highLang = ["Telugu", "Tamil", "Marathi", "Kannada", "Malayalam", "Odia", "Punjabi", "Haryanvi"].includes(language);
  const recs = [];

  if (topPillar.key === "demandSignal") recs.push({ label: "Market angle", value: `Pursue demand-led acquisition in ${cityName}. High quick-commerce density and purchase frequency signal ready demand.`, strong: true });
  else if (topPillar.key === "platformFit") recs.push({ label: "Market angle", value: `Leverage platform maturity in ${cityName}. Benchmark against ${platform.name} operating patterns.`, strong: true });
  else if (topPillar.key === "languageFit") recs.push({ label: "Market angle", value: `Local-language content in ${language} is an under-served wedge in ${cityName}. Start with ${highLang ? "vernacular-first" : "English-supplemented"} creative.`, strong: true });
  else if (topPillar.key === "competition") recs.push({ label: "Market angle", value: `Competitive whitespace exists in ${cityName}. Low saturation means lower CAC and higher early share potential.`, strong: true });
  else recs.push({ label: "Market angle", value: `Evidence confidence is the binding constraint. Validate sources before committing budget.`, strong: false });

  recs.push({ label: "Benchmark brand", value: `${platform.name} — ${platform.currentRole}`, strong: false });
  recs.push({ label: "Campaign channel", value: channel, strong: false });

  if (objective === "Awareness") recs.push({ label: "Message direction", value: "Lead with category-convenience and discovery messaging. Highlight speed, selection, and local relevance." });
  else if (objective === "First order") recs.push({ label: "Message direction", value: "Lead with offer-led urgency. First-order incentive, delivery-promise, and localized category deep link." });
  else if (objective === "Repeat order") recs.push({ label: "Message direction", value: "Lead with retention hooks: habit-forming bundles, scheduled ordering prompts, loyalty nudges." });
  else if (objective === "WhatsApp activation") recs.push({ label: "Message direction", value: "Lead with community-driven conversion. WhatsApp-first onboarding with local-language creative and reply-driven flow." });
  else if (objective === "Society penetration") recs.push({ label: "Message direction", value: "Lead with society-ambassador model. Target residential societies with bulk-order incentives and WhatsApp group seeding." });
  else recs.push({ label: "Message direction", value: "Lead with category expansion angle. Cross-sell from established basket into new category with bundle incentive." });

  recs.push({ label: "Suggested CTA", value: `${objective === "First order" ? "Order now — first delivery free" : objective === "Repeat order" ? "Reorder your regulars in 1 tap" : objective === "WhatsApp activation" ? "Join community, get exclusive local deals" : "Try it in your area today"}` });

  const trackingMetrics = objective === "WhatsApp activation"
    ? "CTR, reply rate, conversion, repeat purchase, CAC proxy, unsubscribe rate"
    : "CTR, conversion rate, repeat purchase rate, AOV, CAC proxy, uninstall/fatigue rate";
  recs.push({ label: "Track", value: trackingMetrics });

  if (weakPillar.adjusted < 5) recs.push({ label: "Risk / caveat", value: `${weakPillar.label} scores low (${weakPillar.adjusted}/10). ${weakPillar.key === "evidenceConf" ? "Decision-grade data is missing — validate before scaling." : "This factor may limit campaign effectiveness."}`, strong: false });
  else recs.push({ label: "Risk / caveat", value: "All pillars are moderate or above. Validate assumptions with a narrow pilot before scaling budget." });

  recs.push({ label: "Next action", value: score >= 70 ? `Run a ${category.toLowerCase()} pilot in ${cityName} with ${channel} as primary channel. Budget INR 5K-15K for 7 days.` : score >= 50 ? `Test a narrow wedge in ${cityName} with minimal spend. Focus on ${topPillar.label.toLowerCase()}.` : `Evidence is weak for ${cityName}. Validate data sources and re-score before committing.` });

  return recs;
}

function oeEvidenceLedger(city, category) {
  const rows = [];
  const sources = marketData.sources || [];
  const metrics = marketData.metricCatalog || [];
  const sourceMap = {};
  sources.forEach(s => { sourceMap[s.id] = s; });

  sources.forEach(s => {
    rows.push({ source: s.name, what: s.usedFor, confidence: s.type, limitation: s.type === "D" ? "Needs validation" : s.type === "C" ? "Partial evidence" : "" });
  });

  const catProfile = categoryProfile(category);
  if (catProfile.risk && catProfile.risk !== "Category benchmark requires independent source.") {
    rows.push({ source: `Category: ${category}`, what: `Purchase frequency (${catProfile.categoryPurchaseFrequency}/10), WhatsApp fit (${catProfile.whatsappConversionFit}/10)`, confidence: "D", limitation: "Framework option — requires validation" });
  }

  const cityConf = city.confidence || "D";
  if (cityConf === "D") {
    rows.push({ source: `City: ${city.city}`, what: `Density, maturity, supply scores are model assumptions`, confidence: "D", limitation: "No primary source — treat as directional" });
  }

  if (!metrics.find(m => m.metric.toLowerCase().includes("quick-commerce") || m.metric.toLowerCase().includes("gov"))) {
    rows.push({ source: "Market sizing", what: "Category-specific GOV", confidence: "D", limitation: "Source mapping incomplete — requires validation" });
  }

  return rows;
}

function oeSignals() {
  const rows = [];
  const hasSources = (marketData.sources || []).length > 0;
  const hasMetrics = (marketData.metricCatalog || []).length > 0;
  const hasCities = (seedData.cities || []).length > 0;
  const hasPlatformIntel = (marketData.platformIntelligence || []).length > 0;
  const hasRagRegistry = !!ragEvidenceLayer?.connectors?.length;
  const hasRagEndpoint = !!getRagApiUrl();

  rows.push({ name: "Public market data", status: hasSources && hasMetrics ? "loaded" : "partial" });
  rows.push({ name: "City-language seed data", status: hasCities ? "loaded" : "partial" });
  rows.push({ name: "Platform intelligence", status: hasPlatformIntel ? "loaded" : "partial" });
  rows.push({ name: "Campaign CSV", status: caCsvData ? "loaded" : "not-connected" });
  rows.push({ name: "RAG connector registry", status: hasRagRegistry ? "loaded" : "partial" });
  rows.push({ name: "News / live market feed", status: hasRagEndpoint ? "partial" : "not-connected" });
  rows.push({ name: "Google Trends / search demand", status: hasRagEndpoint ? "partial" : "not-connected" });
  return rows;
}

function getRagApiUrl() {
  return (localStorage.getItem("bharatRagApiUrl") || "http://127.0.0.1:8787").trim().replace(/\/+$/, "");
}

async function ragFetch(path, { method = "GET", body = null, timeoutMs = 2000, fallback = null } = {}) {
  const base = getRagApiUrl();
  if (!base) return fallback;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const opts = { method, headers: { "Content-Type": "application/json" }, signal: controller.signal };
    if (body) opts.body = JSON.stringify(body);
    const response = await fetch(`${base}${path}`, opts);
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

function ragStatus(message, tone = "info") {
  const el = $("ragStatus");
  if (!el) return;
  el.className = `rag-status ${tone}`;
  el.textContent = message;
}

function selectedRagJob() {
  const jobs = ragEvidenceLayer?.jobs || [];
  return jobs.find(job => job.id === $("ragJobSelect")?.value) || jobs[0] || null;
}

function ragContext() {
  const city = cityFor("citySelect");
  const language = $("languageSelect")?.value || "Telugu";
  const category = $("categorySelect")?.value || "Snacks";
  const platform = getPlatforms().find(item => item.id === $("scorerPlatformSelect")?.value) || selectedPlatform();
  const objective = $("objectiveSelect")?.value || "First order";
  const channel = $("channelSelect")?.value || "WhatsApp broadcast";
  return { city, language, category, platform, objective, channel, job: selectedRagJob() };
}

function populateRagControls() {
  if (!$("ragCitySelect") || !$("ragJobSelect")) return;
  const savedUrl = getRagApiUrl();
  if ($("ragApiUrlInput")) $("ragApiUrlInput").value = savedUrl;
  const currentCity = $("ragCitySelect").value;
  const currentJob = $("ragJobSelect").value;
  $("ragCitySelect").innerHTML = (seedData.cities || []).map(city => `<option value="${escapeHtml(city.city)}">${escapeHtml(city.city)}</option>`).join("");
  const hydOption = [...$("ragCitySelect").options].find(option => option.value === "Hyderabad");
  if (currentCity && [...$("ragCitySelect").options].some(option => option.value === currentCity)) $("ragCitySelect").value = currentCity;
  else if (hydOption) $("ragCitySelect").value = "Hyderabad";
  $("ragJobSelect").innerHTML = (ragEvidenceLayer?.jobs || []).map(job => `<option value="${escapeHtml(job.id)}">${escapeHtml(job.title)}</option>`).join("");
  if (currentJob && [...$("ragJobSelect").options].some(option => option.value === currentJob)) $("ragJobSelect").value = currentJob;
}

function renderRagLayer() {
  if (!$("ragConnectorGrid")) return;
  populateRagControls();
  const connectors = ragEvidenceLayer?.connectors || [];
  const jobs = ragEvidenceLayer?.jobs || [];
  const endpoint = getRagApiUrl();
  const selectedCity = $("ragCitySelect")?.value || "Hyderabad";
  const statusText = endpoint
    ? `Backend endpoint saved: ${endpoint}. Live ingestion and AI brief requests will be sent there.`
    : "No backend endpoint saved. The dashboard will show connector readiness and generate a local evidence-pack brief only.";
  ragStatus(statusText, endpoint ? "ready" : "warn");

  $("ragConnectorGrid").innerHTML = connectors.map(connector => {
    const status = connector.status.replaceAll("_", " ");
    return `
      <div class="rag-connector-card">
        <div class="rag-connector-top">
          <strong>${escapeHtml(connector.name)}</strong>
          <span class="rag-provider">${escapeHtml(connector.provider)}</span>
        </div>
        <span class="rag-status-pill ${escapeHtml(connector.status)}">${escapeHtml(status)}</span>
        <p>${escapeHtml(connector.notes)}</p>
        <div class="rag-tags">${(connector.bestFor || []).slice(0, 4).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <small>Default confidence: ${escapeHtml(connector.confidenceDefault)}</small>
      </div>
    `;
  }).join("");

  const sectionTitle = document.querySelector("#ragJobList")?.closest(".card")?.querySelector("h3");
  if (sectionTitle) sectionTitle.textContent = `${selectedCity} demand and competitor packs`;

  $("ragJobList").innerHTML = jobs.map(job => {
    const dynamicTitle = job.title.replace(/Hyderabad/gi, selectedCity);
    const dynamicQueries = (job.queries || []).map(q => q.replace(/Hyderabad/gi, selectedCity));
    const dynamicTags = (job.outputTags || []).map(t => t === "Hyderabad" ? selectedCity : t);
    return `
      <div class="rag-job-card">
        <strong>${escapeHtml(dynamicTitle)}</strong>
        <p>${escapeHtml(job.cadence)} · ${escapeHtml((job.connectors || []).join(", "))}</p>
        <div class="rag-tags">${dynamicTags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <small>${escapeHtml(dynamicQueries.join(" | "))}</small>
      </div>
    `;
  }).join("");

  const schema = ragEvidenceLayer?.evidenceSchema;
  $("ragSchema").innerHTML = schema ? `
    <div class="rag-schema-grid">
      <div><h4>Required fields</h4><p>${escapeHtml(schema.requiredFields.join(", "))}</p></div>
      ${Object.entries(schema.confidenceRules || {}).map(([key, value]) => `<div><h4>${escapeHtml(key)} confidence</h4><p>${escapeHtml(value)}</p></div>`).join("")}
    </div>
  ` : `<p class="note">Evidence schema not loaded.</p>`;
  renderPipelineWidget();
}

function localEvidenceBrief() {
  const ctx = ragContext();
  const job = ctx.job;
  const selectedCity = $("ragCitySelect")?.value || ctx.city.city;
  const score = calculateScore(ctx.city, ctx.language, ctx.category);
  const sourceRows = oeEvidenceLedger(ctx.city, ctx.category).slice(0, 5);
  const signalRows = (marketSignals?.signals || [])
    .filter(signal => signal.confidence === "A" || signal.confidence === "B")
    .slice(0, 4);
  const validationGaps = [
    "Google Trends, Keyword Planner, Meta Ad Library, YouTube, Reddit, Maps, and app-review data require backend ingestion before they can be cited as live evidence.",
    "Competitor app merchandising should be uploaded as timestamped screenshots because Blinkit/Zepto/Instamart app surfaces do not expose a public API.",
    `${selectedCity}-only conclusions must be separated from India-wide q-commerce benchmarks.`
  ];

  return {
    generatedAt: new Date().toISOString(),
    mode: "local_evidence_pack",
    city: selectedCity,
    language: ctx.language,
    category: ctx.category,
    platform: ctx.platform.name,
    objective: ctx.objective,
    channel: ctx.channel,
    job: job?.title?.replace(/Hyderabad/gi, selectedCity) || "Evidence pack",
    score: score.score,
    confidence: score.confidence || "D",
    sections: [
      {
        title: "Executive answer",
        body: `${selectedCity} / ${ctx.language} / ${ctx.category} is ready for a narrow evidence-gated pilot, not an unqualified scale-up. Current opportunity score is ${score.score}/100 with ${score.confidence || "D"} confidence.`
      },
      {
        title: "Evidence-backed market signal",
        body: sourceRows.map(row => `${row.source}: ${row.what} (${row.confidence})`).join(" ")
      },
      {
        title: "Live signal candidates",
        body: signalRows.length ? signalRows.map(row => `${row.id}: ${row.signal_summary}`).join(" ") : "No loaded A/B confidence market signals are available yet."
      },
      {
        title: "WhatsApp sandbox flow",
        body: `Test ${ctx.language} copy through a backend WhatsApp sandbox. Track delivery, open, reply, click, conversion, unsubscribe, CAC proxy, and repeat rate before updating the score.`
      },
      {
        title: "Shadow pilot plan",
        body: `Run a 7-day shadow pilot for ${ctx.category} in ${selectedCity}. Use ${ctx.channel} as the primary channel and compare against app/category evidence ingested by ${job?.title?.replace(/Hyderabad/gi, selectedCity) || "the selected evidence job"}.`
      },
      {
        title: "Open validation gaps",
        body: validationGaps.join(" ")
      }
    ],
    citations: [
      ...(ragEvidenceLayer?.sampleEvidence || []),
      ...signalRows.map(row => ({ id: row.id, source_name: row.source_name, source_url: row.source_url, confidence: row.confidence }))
    ]
  };
}

function renderRagBrief(brief) {
  const output = $("ragBriefOutput");
  if (!output) return;
  if (brief.mode === "seo_brief") {
    window.__currentSeoBrief = brief;
    renderSeoBrief(brief, output, ragStatus);
    return;
  }
  output.innerHTML = `
    <div class="rag-brief-meta">
      <span>${escapeHtml(brief.mode || "backend_ai")}</span>
      <span>${escapeHtml(brief.city || "")}</span>
      <span>${escapeHtml(brief.category || "")}</span>
      <span>Score ${escapeHtml(brief.score ?? "n/a")}</span>
    </div>
    ${(brief.sections || []).map(section => `
      <div class="rag-brief-section">
        <h4>${escapeHtml(section.title)}</h4>
        <p>${escapeHtml(section.body)}</p>
      </div>
    `).join("")}
    <div class="rag-citations">
      <h4>Citations</h4>
      ${(brief.citations || []).map(cite => `<a href="${escapeHtml(cite.source_url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(cite.id || cite.source_name || "source")} · ${escapeHtml(cite.confidence || "")}</a>`).join("") || "<p class=\"note\">No citations returned.</p>"}
    </div>
  `;
}

async function postRag(path, payload, timeoutMs = 5000) {
  const base = getRagApiUrl();
  if (!base) throw new Error("RAG backend endpoint is not configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`RAG backend returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function generateRagBrief() {
  const ctx = ragContext();
  const selectedCity = $("ragCitySelect")?.value || ctx.city?.city || "Hyderabad";
  const selectedLanguage = $("languageSelect")?.value || ctx.language || "Telugu";
  const selectedCategory = $("categorySelect")?.value || ctx.category || "Grocery";
  const tStart = performance.now();

  ragStatus(`Generating SEO brief for ${selectedCity} ${selectedLanguage} ${selectedCategory}...`, "info");

  const enhancedCtx = {
    ...ctx, city: ctx.city, selectedCity,
    language: selectedLanguage, category: selectedCategory,
    score: calculateScore(ctx.city, selectedLanguage, selectedCategory)?.score || 0,
    confidence: calculateScore(ctx.city, selectedLanguage, selectedCategory)?.confidence || "D"
  };
  const signals = marketSignals?.signals || [];

  // Step 1: Generate brief INSTANTLY from local data (no network calls)
  let evidenceItems = ragEvidenceLayer?.sampleEvidence || [];
  if (marketSignals?.signals?.length) {
    evidenceItems.push(...marketSignals.signals.slice(0, 10).map(s => ({
      id: s.id, claim: s.signal_summary, source_type: "market_signal",
      source_name: s.source_name, source_url: s.source_url,
      confidence: s.confidence, needs_validation: false, tags: ["market_signal"],
      city: "", category: "", captured_at: s.date_published
    })));
  }
  evidenceItems.push(...oeEvidenceLedger(ctx.city, ctx.category).slice(0, 5).map(row => ({
    id: row.source, claim: row.what, source_type: "oe_ledger",
    source_name: row.source, source_url: row.source_url,
    confidence: row.confidence, needs_validation: false,
    tags: [selectedCategory.toLowerCase()],
    city: selectedCity, category: selectedCategory, captured_at: new Date().toISOString()
  })));

  const localBrief = generateSeoBriefContent(enhancedCtx, evidenceItems, signals, ragEvidenceLayer);
  localBrief.mode = "seo_brief_local";
  window.__currentSeoBrief = localBrief;
  renderRagBrief(localBrief);
  const localMs = (performance.now() - tStart).toFixed(0);
  ragStatus(`SEO brief ready (${localMs}ms, local data, ${evidenceItems.length} items).`, "ready");

  // Step 2: PARALLEL backend enrichment (2s timeout each, no blocking)
  const endpoint = getRagApiUrl();
  if (endpoint) {
    const results = await Promise.allSettled([
      postRag("/evidence", { city: selectedCity, category: selectedCategory }, 2000),
      postRag("/brief", {
        context: enhancedCtx,
        localEvidence: { sampleEvidence: evidenceItems, marketSignals: signals }
      }, 2000)
    ]);
    const stored = results[0].status === "fulfilled" ? results[0].value : null;
    const backendBriefResp = results[1].status === "fulfilled" ? results[1].value : null;
    let enhanced = false;
    if (stored?.evidence?.length > evidenceItems.length) {
      const backendBrief = generateSeoBriefContent(enhancedCtx, stored.evidence, signals, ragEvidenceLayer);
      backendBrief.mode = "seo_brief_backend";
      window.__currentSeoBrief = backendBrief;
      renderRagBrief(backendBrief);
      enhanced = true;
    }
    if (backendBriefResp && backendBriefResp.sections) {
      window.__currentBackendBrief = backendBriefResp;
      const cacheHit = backendBriefResp._cache === "hit";
      showToast(cacheHit ? "info" : "success", `Backend brief ${cacheHit ? "loaded from cache" : "generated fresh"} (${backendBriefResp.sections.length} sections)`);
    }
    const totalMs = (performance.now() - tStart).toFixed(0);
    if (enhanced) {
      ragStatus(`SEO brief enhanced with backend evidence (${totalMs}ms total).`, "ready");
    } else {
      ragStatus(`SEO brief ready (${totalMs}ms). Click "Download PDF Report" for professional PDF.`, "ready");
    }
  }
}

async function requestRagIngest() {
  const ctx = ragContext();
  const selectedCity = $("ragCitySelect")?.value || ctx.city?.city || "Hyderabad";
  const dynamicJob = ctx.job ? {
    ...ctx.job,
    title: ctx.job.title.replace(/Hyderabad/gi, selectedCity),
    queries: (ctx.job.queries || []).map(q => q.replace(/Hyderabad/gi, selectedCity))
  } : null;

  const payload = {
    job: dynamicJob,
    city: selectedCity,
    context: {
      city: selectedCity,
      language: ctx.language,
      category: ctx.category,
      platform: ctx.platform?.name || "",
      objective: ctx.objective,
      channel: ctx.channel
    },
    requestedAt: new Date().toISOString()
  };
  try {
    ragStatus("Requesting live ingestion for " + selectedCity + "...", "info");
    const response = await postRag(ragEvidenceLayer?.backendContract?.ingestEndpoint || "/ingest", payload);
    const inserted = response.inserted || 0;
    const sourceTypes = (response.evidence || []).reduce((acc, e) => { acc[e.source_type] = (acc[e.source_type] || 0) + 1; return acc; }, {});
    const breakdown = Object.entries(sourceTypes).map(([k, v]) => `${k}: ${v}`).join(", ");
    ragStatus(`Ingestion complete: ${inserted} records (${breakdown}). Click "Generate AI evidence brief" to curate the SEO report with this new data.`, "ready");
  } catch (error) {
    ragStatus(`${error.message} Save a backend URL to run live scraping.`, "warn");
  }
}

function oeTimelineStep(score) {
  if (!score || score === "--") return 1;
  if (score >= 70) return 4;
  if (score >= 55) return 3;
  if (score >= 40) return 2;
  return 1;
}

function renderOeTimeline(step) {
  const steps = document.querySelectorAll("#oeTimeline .oe-step");
  const active = Math.max(1, Math.min(6, step));
  steps.forEach((el, i) => {
    el.classList.toggle("active", i + 1 === active);
    el.classList.toggle("completed", i + 1 < active);
  });
}

function renderScore() {
  const city = cityFor("citySelect");
  const language = $("languageSelect").value;
  const category = $("categorySelect").value;
  const platform = getPlatforms().find(item => item.id === $("scorerPlatformSelect").value) || selectedPlatform();
  const objective = $("objectiveSelect").value;
  const channel = ($("channelSelect")?.value) || "WhatsApp broadcast";
  const result = calculateScore(city, language, category);
  const confidence = result.confidence || "D";
  const pillars = oePillarScores(result.factors, confidence);
  const confLabel = confidence === "A" ? "A — Verified primary source" : confidence === "B" ? "B — Credible third-party source" : confidence === "C" ? "C — Directional / partial evidence" : "D — Assumption — requires validation";

  $("scoreValue").textContent = result.score;
  $("wedgeTitle").textContent = `${city.city || "City"} / ${language} / ${category} / ${platform.name}`;
  if (result.rawScore !== result.score) {
    $("wedgeNarrative").textContent = `Adjusted from ${result.rawScore} → ${result.score} due to ${confidence}-confidence data. ${city.notes || "Seed data available."} Planning-only until pilot data connects.`;
  } else {
    $("wedgeNarrative").textContent = `${city.notes || "Seed data available."} ${confidenceText(city.confidence || "D")} — planning-only until pilot data connects.`;
  }

  const badge = $("oeConfidenceBadge");
  badge.textContent = `Confidence: ${confLabel}`;
  badge.className = `oe-confidence-badge conf-${confidence.toLowerCase()}`;

  $("scoreBreakdown").innerHTML = `<div class="oe-factors-grid">${Object.entries(result.factors).map(([key, value]) =>
    `<div class="oe-factor-row"><span class="oe-factor-name">${OE_FACTOR_LABELS[key] || key}</span><div class="oe-factor-bar"><div class="oe-factor-bar-fill" style="width:${value * 10}%"></div></div><span class="oe-factor-value">${value}/10</span><span class="oe-factor-weight">${OE_WEIGHT_LABELS[key] || ""}</span></div>`
  ).join("")}</div>`;

  const recs = oeRecommendation(city, language, category, platform, objective, channel, result.score, pillars);
  $("oeRecommendation").innerHTML = recs.map(r => `<div class="oe-rec-item"><div class="oe-rec-label">${escapeHtml(r.label)}</div><div class="oe-rec-value${r.strong ? " strong" : ""}">${escapeHtml(r.value)}</div></div>`).join("");

  renderOeTimeline(oeTimelineStep(result.score));
  renderOeEvidence(city, category);
  renderOeSignals();

  if (!$("oeExplainPanel").classList.contains("hidden")) {
    renderExplainPanel();
  }
}

function renderOeEvidence(city, category) {
  const rows = oeEvidenceLedger(city, category);
  $("oeEvidenceLedger").innerHTML = rows.map(r => `<div class="oe-evidence-row"><span class="oe-evidence-source">${escapeHtml(r.source)}</span><span class="oe-evidence-what">${escapeHtml(r.what)}</span><span class="oe-evidence-conf conf-${r.confidence.toLowerCase()}">${r.confidence}</span></div>`).join("");
}

async function renderOeSignals() {
  const container = $("oeSignals");
  if (!container) return;
  const city = cityFor("citySelect");
  const category = $("categorySelect")?.value || "Grocery";
  container.innerHTML = `<div class="oe-signal-row"><span class="oe-signal-name">Backend live signals</span><span class="oe-signal-status partial">Loading from backend...</span></div>`;
  try {
    const response = await postBackend("/signals", { city: city.city || "Hyderabad", category, limit: 8 });
    const signals = response.signals || [];
    if (!signals.length) {
      container.innerHTML = `<p class="note">No live signals for ${escapeHtml(city.city || "this city")} ${escapeHtml(category)} yet. Run the Ingestion agent from the Pipeline tab to populate.</p>`;
      return;
    }
    container.innerHTML = `
      <div class="oe-signals-summary">
        <span class="oe-signal-status loaded">${signals.length} signals</span>
        <span class="oe-signal-status ${response.sources?.live_ingestion > 0 ? "loaded" : "partial"}">${response.sources?.live_ingestion || 0} live</span>
        <span class="oe-signal-status partial">${response.sources?.market_research || 0} research</span>
      </div>
    ` + signals.map(signal => `
      <div class="oe-signal-card">
        <span class="signal-tag type-tag">${escapeHtml(signal.signal_type || "Market signal")}</span>
        <strong>${escapeHtml((signal.headline || "").replace(/<[^>]*>/g, "").slice(0, 200))}</strong>
        <p>${escapeHtml(signal.marketing_action || "")}</p>
        <small>${escapeHtml(signal.urgency || "")} · ${escapeHtml(signal.source || "")} · ${escapeHtml(signal.brand || "")}</small>
      </div>
    `).join("");
  } catch (error) {
    console.warn("Backend signals failed.", error);
    container.innerHTML = `<p class="note">Signals unavailable - check backend connection. <button class="secondary-btn" id="oeSignalsRetry">Retry</button></p>`;
    $("oeSignalsRetry")?.addEventListener("click", () => renderOeSignals());
  }
}

function populateConsumerSignalControls() {
  const citySelect = $("csCity");
  if (citySelect) {
    citySelect.innerHTML = (seedData.cities || []).map(city => `<option value="${escapeHtml(city.city)}">${escapeHtml(city.city)}</option>`).join("");
    if ($("citySelect")?.value) citySelect.value = $("citySelect").value;
  }

  const categorySelect = $("csCategory");
  if (categorySelect) {
    categorySelect.innerHTML = (seedData.categories || []).map(category => `<option>${escapeHtml(category)}</option>`).join("");
    if ($("categorySelect")?.value) categorySelect.value = $("categorySelect").value;
  }
}

function classifyConsumerSignal() {
  const city = $("csCity")?.value || cityFor("citySelect").city || "Selected city";
  const category = $("csCategory")?.value || $("categorySelect")?.value || "Grocery";
  const type = $("csSignalType")?.value || "";
  const volume = Number($("csVolume")?.value || 0);
  const verbatim = $("csVerbatim")?.value.trim() || "";
  const mapper = SIGNAL_ACTION_MAP[type];
  const outputEl = $("csOutput");
  if (!mapper || !outputEl) return;

  const action = mapper(city, category);
  const volumeLine = volume > 0
    ? `${volume} signals this week - treat as ${volume >= 20 ? "city-level pattern" : "early signal"}.`
    : "Volume not provided - treat as anecdotal until volume is logged.";

  outputEl.innerHTML = `
    <div class="oe-brief-field"><div class="oe-brief-field-label">Marketing relevance</div><div class="oe-brief-field-value">${escapeHtml(action.marketingRelevance)}</div></div>
    <div class="oe-brief-field"><div class="oe-brief-field-label">Copy action</div><div class="oe-brief-field-value">${escapeHtml(action.copyAction)}</div></div>
    <div class="oe-brief-field"><div class="oe-brief-field-label">Channel action</div><div class="oe-brief-field-value">${escapeHtml(action.channelAction)}</div></div>
    <div class="oe-brief-field"><div class="oe-brief-field-label">Brief update flag</div><div class="oe-brief-field-value">${escapeHtml(action.briefUpdate)}</div></div>
    <p class="note">${escapeHtml(volumeLine)}</p>
    ${verbatim ? `<p class="note">Verbatim sample, anonymized:<br>${escapeHtml(verbatim)}</p>` : ""}
    <button class="secondary-btn" id="csPushToBrief">Push to Campaign Brief</button>
  `;

  $("csPushToBrief")?.addEventListener("click", () => {
    pushConsumerSignalToBrief(action.briefUpdate);
    $("csPushToBrief").textContent = "Pushed to brief";
    $("csPushToBrief").disabled = true;
  });
}

function pushConsumerSignalToBrief(flagText) {
  if (!window._oeBriefData) generateBriefStatic();
  window._oeBriefData.consumerSignalFlag = flagText;

  const briefEl = $("oeBrief");
  if (!briefEl) return;

  let signalField = briefEl.querySelector("[data-consumer-signal]");
  if (!signalField) {
    signalField = document.createElement("div");
    signalField.dataset.consumerSignal = "true";
    signalField.className = "oe-brief-field";
    briefEl.appendChild(signalField);
  }
  signalField.innerHTML = `<div class="oe-brief-field-label">Consumer signal</div><div class="oe-brief-field-value">${escapeHtml(flagText)}</div>`;
}

function populatePriceWatchControls() {
  const citySelect = $("pwCity");
  if (!citySelect) return;
  citySelect.innerHTML = (seedData.cities || []).map(city => `<option value="${escapeHtml(city.city)}">${escapeHtml(city.city)}</option>`).join("");
  if ($("citySelect")?.value) citySelect.value = $("citySelect").value;
}

function computePriceGapAlert(yourPrice, competitorPrice, threshold = 0.10) {
  const your = Number(yourPrice);
  const competitor = Number(competitorPrice);
  if (!your || !competitor) return null;

  const gap = (competitor - your) / your;
  const gapPercent = gap * 100;
  const absGap = Math.abs(gap);
  const competitorCheaper = gap < 0;

  if (absGap < threshold) {
    return {
      severity: "low",
      gapPercent: gapPercent.toFixed(1),
      message: `Price gap of ${gapPercent.toFixed(1)}%. Within monitoring threshold.`
    };
  }

  return {
    severity: "high",
    gapPercent: gapPercent.toFixed(1),
    message: `Price gap of ${Math.abs(gapPercent).toFixed(1)}% detected. Competitor is ${competitorCheaper ? "cheaper" : "more expensive"}. ${competitorCheaper ? "Consider bundle offer, pack-size anchor, or price match in this city/platform." : "Pricing power window open; hold price and test value-led communication."}`
  };
}

function renderPriceWatchTable() {
  const container = $("pwGapTable");
  if (!container) return;

  if (!priceWatchList.length) {
    container.innerHTML = `<p class="note">No SKUs added yet. Add a SKU above to see price gap analysis.</p>`;
    return;
  }

  container.innerHTML = `
    <table>
      <thead><tr><th>#</th><th>SKU</th><th>Platform</th><th>City</th><th>Your price</th><th>Competitor price</th><th>Gap</th></tr></thead>
      <tbody>
        ${priceWatchList.map((item, index) => {
          const alert = computePriceGapAlert(item.yourPrice, item.competitorPrice) || {};
          const severityClass = alert.severity === "high" ? "gap-high" : "gap-ok";
          return `<tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.sku)}</td>
            <td>${escapeHtml(item.platform)}</td>
            <td>${escapeHtml(item.city)}</td>
            <td>INR ${item.yourPrice.toFixed(2)}</td>
            <td>INR ${item.competitorPrice.toFixed(2)}</td>
            <td class="${severityClass}">${escapeHtml(alert.gapPercent || "--")}%</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderPriceWatchAlerts() {
  const container = $("pwAlerts");
  if (!container) return;

  if (!priceWatchList.length) {
    container.innerHTML = `<p class="note">Add SKUs to watchlist to see gap alerts.</p>`;
    return;
  }

  container.innerHTML = priceWatchList.map(item => {
    const alert = computePriceGapAlert(item.yourPrice, item.competitorPrice);
    const backend = item.backendAlert;
    if (!alert) return "";
    return `<div class="price-alert price-alert-${alert.severity}">
      <strong>${escapeHtml(item.sku)}</strong> - ${escapeHtml(item.platform)} - ${escapeHtml(item.city)}<br>
      ${escapeHtml(backend ? `${backend.alert_level.toUpperCase()}: ${backend.recommendation} ${backend.suggested_action}` : alert.message)}
    </div>`;
  }).join("");
}

function renderPriceWatchTrend() {
  const container = $("pwTrendChart");
  if (!container) return;

  if (!priceWatchLog.length) {
    container.textContent = "Manual trend chart placeholder - add SKU entries to start a dated update log.";
    return;
  }

  container.innerHTML = `
    <div class="pw-log-list">
      ${priceWatchLog.slice().reverse().map(entry => {
        const alert = computePriceGapAlert(entry.yourPrice, entry.competitorPrice);
        return `<div class="pw-log-row">
          <span>${escapeHtml(entry.date)}</span>
          <strong>${escapeHtml(entry.sku)}</strong>
          <p>${escapeHtml(entry.city)} / ${escapeHtml(entry.platform)} - your INR ${entry.yourPrice.toFixed(2)}, competitor INR ${entry.competitorPrice.toFixed(2)}, gap ${escapeHtml(alert?.gapPercent || "--")}%</p>
        </div>`;
      }).join("")}
    </div>
  `;
}

async function addPriceWatchSku() {
  const sku = $("pwSku")?.value.trim();
  const yourPrice = Number($("pwYourPrice")?.value);
  const competitorPrice = Number($("pwCompetitorPrice")?.value);
  const platform = $("pwPlatform")?.value || "";
  const city = $("pwCity")?.value || "";
  const status = $("pwStatus");

  if (!sku || !yourPrice || !competitorPrice) {
    if (status) status.textContent = "Enter SKU, your price, and competitor price.";
    return;
  }

  const entry = { sku, yourPrice, competitorPrice, platform, city, date: new Date().toISOString().slice(0, 10), backendAlert: null };
  try {
    entry.backendAlert = await postBackend("/pricewatch", {
      sku,
      your_price: yourPrice,
      competitor_price: competitorPrice,
      city,
      platform
    });
  } catch (error) {
    console.warn("Backend pricewatch failed; using static price alert.", error);
  }
  priceWatchList.push(entry);
  priceWatchLog.push(entry);

  ["pwSku", "pwYourPrice", "pwCompetitorPrice"].forEach(id => { if ($(id)) $(id).value = ""; });
  if (status) status.textContent = "SKU added to watchlist.";
  renderPriceWatchTable();
  renderPriceWatchAlerts();
  renderPriceWatchTrend();
}

function generateBriefStatic() {
  const city = cityFor("citySelect");
  const language = $("languageSelect").value;
  const category = $("categorySelect").value;
  const platform = getPlatforms().find(item => item.id === $("scorerPlatformSelect").value) || selectedPlatform();
  const objective = $("objectiveSelect").value;
  const channel = ($("channelSelect")?.value) || "WhatsApp broadcast";
  const result = calculateScore(city, language, category);
  const confidence = result.confidence || "D";
  const pillars = oePillarScores(result.factors, confidence);
  const recs = oeRecommendation(city, language, category, platform, objective, channel, result.score, pillars);

  const fields = [
    { label: "Objective", value: objective },
    { label: "Target city", value: `${city.city}, ${city.state || ""}` },
    { label: "Use-case", value: category },
    { label: "Benchmark reference", value: platform.name },
    { label: "Language angle", value: language },
    { label: "Campaign channel", value: channel },
    { label: "Opportunity score", value: `${result.score}/100 (${confidence})` },
    { label: "Message direction", value: (recs.find(r => r.label === "Message direction") || {}).value || "—" },
    { label: "Suggested CTA", value: (recs.find(r => r.label === "Suggested CTA") || {}).value || "—" },
    { label: "Track", value: (recs.find(r => r.label === "Track") || {}).value || "—" },
    { label: "Risk / caveat", value: (recs.find(r => r.label === "Risk / caveat") || {}).value || "—" },
    { label: "Next action", value: (recs.find(r => r.label === "Next action") || {}).value || "—" }
  ];

  window._oeBriefData = { city: city.city, language, category, platform: platform.name, objective, channel, score: result.score, confidence, pillars, recommendations: recs, fields, generatedAt: new Date().toISOString(), benchmark: exportBenchmarkState() };

  $("oeBrief").innerHTML = fields.map(f => `<div class="oe-brief-field"><div class="oe-brief-field-label">${escapeHtml(f.label)}</div><div class="oe-brief-field-value">${escapeHtml(f.value)}</div></div>`).join("");
  $("oeValidationBanner").classList.add("hidden");
}

async function generateBrief() {
  const city = cityFor("citySelect");
  const language = $("languageSelect").value;
  const category = $("categorySelect").value;
  const platform = getPlatforms().find(item => item.id === $("scorerPlatformSelect").value) || selectedPlatform();
  const objective = $("objectiveSelect").value;
  const channel = ($("channelSelect")?.value) || "WhatsApp broadcast";
  const payload = {
    city: city.city,
    language,
    category,
    platform: platformPayloadValue(platform),
    objective,
    channel,
    offer: $("caOffer")?.value || "",
    tone: $("caTone")?.value || "Local",
    benchmarkPlatform: selectedPlatform()?.id || platformPayloadValue(platform)
  };

  const briefEl = $("oeBrief");
  briefEl.innerHTML = `<p class="note">Generating AI brief from backend...</p>`;
  try {
    const response = await postBackend("/brief", payload);
    window._oeBriefData = {
      city: payload.city,
      language,
      category,
      platform: platform.name,
      objective,
      channel,
      backend: response,
      generatedAt: new Date().toISOString()
    };
    const fields = [
      ["Headline", response.brief_headline],
      ["Strategic rationale", response.strategic_rationale],
      ["City hook", response.city_hook],
      ["English draft", response.english_draft],
      ["Vernacular draft", response.vernacular_draft],
      ["WhatsApp message", response.whatsapp_message],
      ["Checklist", (response.checklist || []).join(" | ")],
      ["Confidence", response.confidence_level]
    ];
    briefEl.innerHTML = fields.map(([label, value]) => `<div class="oe-brief-field"><div class="oe-brief-field-label">${escapeHtml(label)}</div><div class="oe-brief-field-value">${escapeHtml(value)}</div></div>`).join("");
    $("oeValidationBanner").classList.add("hidden");
  } catch (error) {
    console.warn("Backend brief failed; using static brief.", error);
    generateBriefStatic();
  }
}

async function copyBrief() {
  if (!window._oeBriefData) { await generateBrief(); }
  if (!window._oeBriefData) return;
  const text = window._oeBriefData.fields
    ? window._oeBriefData.fields.map(f => `${f.label}: ${f.value}`).join("\n")
    : $("oeBrief").innerText;
  try {
    await navigator.clipboard.writeText(text);
    $("oeCopyBrief").textContent = "Copied!";
    setTimeout(() => { $("oeCopyBrief").textContent = "Copy brief"; }, 2000);
  } catch(e) { console.warn("Clipboard write failed", e); }
}

function exportJson() {
  if (!window._oeBriefData) { generateBriefStatic(); }
  const exportData = { ...window._oeBriefData };
  if (caDraftData) {
    exportData.campaign = {
      city: caDraftData.city,
      useCase: caDraftData.useCase,
      language: caDraftData.language,
      benchmark: caDraftData.benchmark,
      objective: caDraftData.objective,
      channel: caDraftData.channel,
      messageDrafts: caDraftData.messageDrafts,
      trackingMetrics: caDraftData.trackingMetrics || ["Delivered", "Opened", "Clicked", "Replied", "Converted", "Repeat purchase", "Unsubscribed", "Spend", "Revenue"],
      metricResults: caMetrics || null,
      validationWarnings: caDraftData.validationWarnings,
      learningNote: localStorage.getItem("caLearningNote") || ""
    };
  }
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `opportunity-brief-${window._oeBriefData.city}-${window._oeBriefData.category}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function markValidation() {
  const banner = $("oeValidationBanner");
  if (banner.classList.contains("hidden")) {
    banner.textContent = "Decision caveats: This brief contains assumptions that require independent validation before committing budget. Score and recommendations are directional until live pilot data is connected.";
    banner.classList.remove("hidden");
    $("oeMarkValidation").textContent = "Remove validation flag";
  } else {
    banner.classList.add("hidden");
    $("oeMarkValidation").textContent = "Mark needs validation";
  }
}

function toggleExplain() {
  const panel = $("oeExplainPanel");
  panel.classList.toggle("hidden");
  $("oeExplainToggle").textContent = panel.classList.contains("hidden") ? "Why this score?" : "Hide explanation";
}

function renderExplainPanel() {
  const city = cityFor("citySelect");
  const language = $("languageSelect").value;
  const category = $("categorySelect").value;
  const platform = getPlatforms().find(item => item.id === $("scorerPlatformSelect").value) || selectedPlatform();
  const result = calculateScore(city, language, category);
  const confidence = result.confidence || "D";
  const pillars = oePillarScores(result.factors, confidence);
  const confMultiplier = { A: 1, B: 0.95, C: 0.85, D: 0.7 }[confidence] || 0.7;
  const cityConf = city.confidence || "D";

  const missing = [];
  if (cityConf === "D") missing.push("City scores are model assumptions — no primary source");
  if (categoryProfile(category).risk && categoryProfile(category).risk !== "Category benchmark requires independent source.") missing.push(`Category risk: ${categoryProfile(category).risk}`);
  if (!(marketData.metricCatalog || []).find(m => m.metric.toLowerCase().includes(category.toLowerCase()))) missing.push(`No specific ${category} GOV data in public catalog`);

  $("oeExplainContent").innerHTML = `
    <h4>Scoring formula</h4>
    <p>Raw score = weighted sum of 8 factors (max 100). Confidence multiplier (${confMultiplier}× for ${confidence}-level data) adjusts the final score: <strong>${result.rawScore}</strong> → <strong>${result.score}</strong>.</p>
    <ul>${pillars.map(p => `<li><strong>${p.label}</strong> (${Math.round(p.weight * 100)}%): raw ${p.raw}/10 → adjusted ${p.adjusted}/10 → contributes ${p.weighted.toFixed(1)} points</li>`).join("")}</ul>
    <h4>Selected inputs</h4>
    <ul>
      <li>City: ${escapeHtml(city.city)} (${cityConf})</li>
      <li>Language: ${escapeHtml(language)} (gap score: ${languageGapScore(language)}/10)</li>
      <li>Category: ${escapeHtml(category)}</li>
      <li>Platform: ${escapeHtml(platform.name)} (${platform.sourceQuality || "D"})</li>
    </ul>
    <h4>Multiplier applied: ${confMultiplier} (${confidence}-confidence)</h4>
    ${missing.length ? `<h4>Missing / uncertain data</h4><ul>${missing.map(m => `<li>${escapeHtml(m)}</li>`).join("")}</ul>` : ""}
  `;
}

function renderKpis() {
  const kpis = [
    kpiFromMetric("GOV", metricByText("India quick-commerce GOV"), "Gross order value: total value of orders before deductions.", "Sizes the market opportunity."),
    kpiFromMetric("MTU", metricByText("MTUs"), "Monthly transacting users: users ordering in a month.", "Shows active adoption for a platform."),
    kpiFromMetric("AOV", metricByText("AOV"), "Average order value.", "Helps shape bundles and offer thresholds."),
    missingKpi("CAC", "Cost to acquire one paying customer.", "Requires pilot spend and orders."),
    missingKpi("Repeat rate", "How often a customer comes back in the tracking window.", "Requires pilot customer-level data."),
    kpiFromMetric("Dark stores", metricByText("dark stores"), "Local fulfillment nodes used for quick delivery.", "Indicates operating infrastructure."),
    kpiFromMetric("Cities covered", { value: "124 cities", sourceId: "swiggy_q4fy25", confidence: "A", dateOrYear: "Q4FY25" }, "Serviceable city footprint.", "Defines expansion surface."),
    kpiFromMetric("Market share", metricByText("market share"), "Share of quick-commerce market.", "Signals benchmark power and saturation risk.")
  ];

  $("kpiStrip").innerHTML = kpis.map((kpi, index) => `
    <article class="kpi-card" data-kpi="${index}" title="${escapeHtml(kpi.definition)}">
      <div class="kpi-label">${escapeHtml(kpi.label)}</div>
      <div class="kpi-value">${escapeHtml(kpi.value)}</div>
      <div class="kpi-caption">${escapeHtml(kpi.status)}</div>
    </article>
  `).join("");

  document.querySelectorAll("[data-kpi]").forEach(card => {
    card.addEventListener("click", () => renderKpiDetail(kpis[Number(card.dataset.kpi)]));
  });
}

function kpiFromMetric(label, metric, definition, why) {
  if (!metric) return missingKpi(label, definition, why);
  return {
    label,
    value: metric.value,
    definition,
    why,
    status: metric.confidence === "A" || metric.confidence === "B" ? "Public data" : "Requires validation",
    source: sourceLabelReadable(metric.sourceId),
    confidence: metric.confidence || "D"
  };
}

function missingKpi(label, definition, why) {
  return { label, value: "Awaiting pilot data", definition, why, status: "Awaiting pilot data", source: "Requires pilot CSV upload", confidence: "D" };
}

function renderKpiDetail(kpi) {
  $("kpiDetail").classList.remove("hidden");
  $("kpiDetail").innerHTML = `
    <div class="section-title"><p class="eyebrow">${escapeHtml(kpi.label)} detail</p><button class="secondary-btn" id="closeKpiDetail">Close</button></div>
    <div class="status-grid">
      <div class="status-item"><h4>Definition</h4><p>${escapeHtml(kpi.definition)}</p></div>
      <div class="status-item"><h4>Why it matters</h4><p>${escapeHtml(kpi.why)}</p></div>
      <div class="status-item"><h4>Data status</h4><p>${escapeHtml(kpi.status)} - ${escapeHtml(confidenceText(kpi.confidence))}</p><p>${escapeHtml(kpi.source)}</p></div>
    </div>
  `;
  $("closeKpiDetail").addEventListener("click", () => $("kpiDetail").classList.add("hidden"));
}

function renderPlatformIntelligence() {
  const platform = selectedPlatform();
  updateTheme(platform.id);
  const lens = $("benchmarkLensSelect")?.value || "Pilot-readiness lens";
  $("platformIntelligence").innerHTML = `
    <div class="badge-row">
      <span class="source-badge ${platform.sourceQuality === "D" ? "badge-assumption" : "badge-primary"}">${escapeHtml(confidenceText(platform.sourceQuality))}</span>
      <span class="muted-badge">Benchmark Lens: ${escapeHtml(lens)}</span>
      <span class="muted-badge">${platform.id === "dunzo" ? "Historical cautionary case only" : "Benchmark lens active"}</span>
    </div>
    <div class="platform-intel-grid">
      ${intelCell("Role", platform.currentRole)}
      ${intelCell("Public metrics", platform.publicMetrics.join("; "))}
      ${intelCell("Growth strengths", platform.strengths.join("; "))}
      ${intelCell("Weaknesses / risks", platform.risks.join("; "))}
      ${intelCell("GTM implication", platform.gtmImplication)}
      ${intelCell("Source note", platform.sourceNote)}
      ${intelCell("Lens implication", lensImplication(lens, platform))}
    </div>
  `;
}

function lensImplication(lens, platform) {
  if (lens.includes("Market leader")) return "Compare against category leadership, then avoid saturated head-on entry.";
  if (lens.includes("Challenger")) return "Look for youth, impulse, local creator, and category wedge tests.";
  if (lens.includes("Operating")) return "Prioritize serviceability, store density, AOV, and MTU context.";
  if (lens.includes("Failure")) return "Stress-test burn, operations, stock, attribution, and repeat economics.";
  return platform.sourceQuality === "D" ? "Pilot only after source gaps are clear." : "Ready for a narrow measured pilot with CSV tracking.";
}

function intelCell(title, body) {
  return `<div><h4>${escapeHtml(title)}</h4><p>${escapeHtml(body || "Requires independent source")}</p></div>`;
}

function renderCampaignStatus() {
  const rows = [
    ["Public market data", "Loaded", "Sourced from CareEdge, Swiggy FY25, Economic Times, and Global Newswire."],
    ["Competitor data", "Partial / source-dependent", "Some platforms have stronger disclosed metrics than others."],
    ["Evidence RAG", getRagApiUrl() ? "Backend configured" : "Backend endpoint needed", getRagApiUrl() ? "Scraping and AI brief requests can be routed to your secure backend." : "Connector registry is loaded, but live scraping requires a backend URL and server-side API keys."],
    ["Pilot campaign CSV", pilotCampaignUploaded ? "Uploaded" : "Awaiting upload", pilotCampaignUploaded ? "Campaign calculations now use uploaded CSV data." : "No campaign performance data has been uploaded yet. Dashboard plans experiments but does not claim results."],
    ["Report export", "Ready", "Stakeholder-ready executive reports can be generated and exported."],
    ["Missing data", "Requires independent source", "BigBasket Now and Dunzo public metrics require stronger public sources."]
  ];
  $("campaignStatusPanel").innerHTML = rows.map(([label, status, meaning]) => `
    <div class="status-item">
      <h4>${escapeHtml(label)}</h4>
      <p><strong>${escapeHtml(status)}</strong></p>
      <p>${escapeHtml(meaning)}</p>
    </div>
  `).join("");
  $("campaignStatusMessage").textContent = "Campaign metrics are intentionally empty until a real pilot CSV is uploaded. The dashboard plans experiments and generates structured briefs — it does not fabricate results.";
}

function renderMarketPulse() {
  const platform = selectedPlatform();
  const metric = $("marketMetricSelect").value;
  const view = $("marketViewSelect").value;
  const config = metricConfig(platform, metric);
  $("marketInsightHeadline").textContent = config.headline;
  $("marketSoWhat").textContent = `${config.soWhat} View: ${view.replaceAll("_", " ")}.`;
  $("marketNextAction").textContent = config.nextAction;
  $("marketInsightBadges").innerHTML = `<span class="source-badge">Source: ${escapeHtml(config.source)}</span><span class="source-badge">${escapeHtml(confidenceText(config.confidence))}</span><span class="source-badge">${escapeHtml(config.status)}</span>`;
  $("marketChartSource").textContent = `${config.source}. ${config.status}.`;
  if (!config.data.length) {
    $("marketDynamicChart").innerHTML = `<div class="empty-chart">Data unavailable in current public dataset — requires independent source.</div>`;
    return;
  }
  if (config.chart === "line") drawLineChart("marketDynamicChart", config.data, config);
  else drawBarChart("marketDynamicChart", config.data, config);
}

function metricConfig(platform, metric) {
  const instamart = marketData.instamartSeries || [];
  const publicSource = metric === "gov" || metric === "darkStores" ? "CareEdge Advisory" : platform.id === "instamart" ? "Swiggy FY25 Shareholder Letter" : sourceLabel(platform.sourceId);
  const unavailable = {
    data: [], chart: "bar", unit: "Requires validation", source: "Requires independent source", confidence: "D", status: "Requires validation",
    headline: `${platform.name} ${metric} data requires independent source.`,
    soWhat: "Do not benchmark a metric without a verifiable source.",
    nextAction: "Use public market context or upload a pilot CSV."
  };
  const configs = {
    gov: { data: marketData.govSeries || [], chart: "bar", unit: "GOV, INR crore", prefix: "INR ", source: "CareEdge Advisory", confidence: "B", status: "Public data", headline: "Quick commerce is transitioning from convenience behavior to daily habit.", soWhat: "Prioritize high-frequency categories for entry.", nextAction: "Plan one city-language pilot with strict CAC guardrails." },
    darkStores: { data: marketData.darkStoreSeries || [], chart: "bar", unit: "Dark stores", source: "CareEdge Advisory", confidence: "B", status: "Public data", headline: "Infrastructure scale-up enables faster local delivery promises.", soWhat: "Select cities where serviceability supports the offer.", nextAction: "Verify pin-code coverage before launch." },
    mtu: platform.id === "instamart" ? instamartLine("mtu", "Average MTUs, million", value => `${value}M`, "MTUs indicate active customer adoption scale.") : unavailable,
    aov: platform.id === "instamart" ? instamartLine("aov", "AOV, INR", value => `INR ${formatNumber(value)}`, "AOV shapes bundle and offer threshold decisions.") : unavailable,
    orders: platform.id === "instamart" ? instamartLine("orders", "Orders, million", value => `${value}M`, "Order volume reflects platform operating scale.") : unavailable,
    citiesCovered: platform.id === "instamart" ? { data: [{ period: "Q4FY25", value: 124 }], chart: "bar", unit: "Cities", source: "Swiggy FY25 Shareholder Letter", confidence: "A", status: "Public data", headline: "Instamart city footprint provides a serviceability benchmark.", soWhat: "Use footprint as context, not proof of campaign success.", nextAction: "Select one serviceable city-language wedge." } : unavailable,
    marketShare: platform.id === "blinkit" ? { data: [{ period: "Blinkit", value: 50 }], chart: "bar", unit: "Market share, %", suffix: "%", source: "Economic Times citing BofA", confidence: "B", status: "Public data", headline: "Blinkit leadership makes it a benchmark and a saturation signal.", soWhat: "Avoid head-on competition in saturated wedges.", nextAction: "Identify category-language pockets with less direct competition." } : unavailable
  };
  return { ...configs[metric], source: configs[metric]?.source || publicSource };
}

function instamartLine(key, unit, formatter, headline) {
  return { data: (marketData.instamartSeries || []).map(row => ({ period: row.period, value: row[key] })), chart: "line", unit, valueFormatter: formatter, source: "Swiggy FY25 Shareholder Letter", confidence: "A", status: "Public data", headline, soWhat: "Use operating metrics as benchmark context only — not as proof of campaign efficiency.", nextAction: "Run your own measured pilot before making performance claims." };
}

function drawBarChart(containerId, data, options) {
  const container = $(containerId);
  const width = container.clientWidth || 720;
  const height = 310;
  const margin = { top: 30, right: 24, bottom: 50, left: 62 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const max = Math.max(...data.map(item => item.value), 1) * 1.12;
  const barWidth = Math.max(30, innerWidth / data.length - 18);
  const color = getComputedStyle(document.documentElement).getPropertyValue("--theme-primary").trim();
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
    <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,0.16)" />
    ${data.map((item, index) => {
      const x = margin.left + index * (innerWidth / data.length) + 9;
      const h = (item.value / max) * innerHeight;
      const y = height - margin.bottom - h;
      const label = `${options.prefix || ""}${formatNumber(item.value)}${options.suffix || ""}`;
      return `<g><title>${escapeHtml(item.period)}: ${escapeHtml(label)}</title><rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="8" fill="${color}" /><text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" fill="#f8fafc" font-size="12">${escapeHtml(label)}</text><text x="${x + barWidth / 2}" y="${height - 18}" text-anchor="middle" fill="#9ca3af" font-size="12">${escapeHtml(item.period)}</text></g>`;
    }).join("")}
    <text x="${margin.left}" y="18" fill="#9ca3af" font-size="12">${escapeHtml(options.unit || "")}</text>
  </svg>`;
}

function drawLineChart(containerId, data, options) {
  const container = $(containerId);
  const width = container.clientWidth || 720;
  const height = 310;
  const margin = { top: 30, right: 28, bottom: 50, left: 62 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const max = Math.max(...data.map(item => item.value), 1) * 1.12;
  const color = getComputedStyle(document.documentElement).getPropertyValue("--theme-primary").trim();
  const points = data.map((item, index) => ({ ...item, x: margin.left + (index / Math.max(1, data.length - 1)) * innerWidth, y: height - margin.bottom - (item.value / max) * innerHeight }));
  const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
    <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,0.16)" />
    <path d="${path}" fill="none" stroke="${color}" stroke-width="4" />
    ${points.map(point => `<g><title>${escapeHtml(point.period)}: ${escapeHtml(options.valueFormatter(point.value))}</title><circle cx="${point.x}" cy="${point.y}" r="5" fill="${color}" /><text x="${point.x}" y="${point.y - 12}" text-anchor="middle" fill="#f8fafc" font-size="12">${escapeHtml(options.valueFormatter(point.value))}</text><text x="${point.x}" y="${height - 18}" text-anchor="middle" fill="#9ca3af" font-size="12">${escapeHtml(point.period)}</text></g>`).join("")}
    <text x="${margin.left}" y="18" fill="#9ca3af" font-size="12">${escapeHtml(options.unit || "")}</text>
  </svg>`;
}

function renderProofCards() {
  const metrics = marketData.metricCatalog || [];
  $("proofCards").innerHTML = metrics.map(metric => {
    const source = sourceById(metric.sourceId);
    const displayName = SOURCE_DISPLAY[metric.sourceId] || (source ? source.name : "Needs source");
    return `<details class="proof-card"><summary>${escapeHtml(metric.metric)}<span class="proof-value">${escapeHtml(metric.value)}</span></summary><p class="proof-detail">${escapeHtml(source?.usedFor || "Source note unavailable.")}</p><p><span class="source-badge ${metric.confidence === "D" ? "badge-assumption" : "badge-primary"}">${escapeHtml(confidenceText(metric.confidence))}</span> <span class="muted-badge">${escapeHtml(displayName)}</span></p>${source?.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer" class="source-link">View source</a>` : `<span class="muted-badge">Needs independent source</span>`}</details>`;
  }).join("");
}

function renderSources() {
  const confidence = { A: "Verified primary source", B: "Credible third-party source", C: "Vendor/case-study source", D: "Model assumption - requires validation" };
  const confidenceColors = { A: "#34d399", B: "#fbbf24", C: "#fb923c", D: "#f87171" };
  $("sourceTable").innerHTML = (marketData.sources || []).map(source => {
    const displayName = SOURCE_DISPLAY[source.id] || source.name;
    const color = confidenceColors[source.type] || "#94a3b8";
    return `
      <details class="source-card">
        <summary><span class="source-card-title">${escapeHtml(displayName)}</span><span class="confidence-dot" style="background:${color}"></span></summary>
        <p><span class="source-badge ${source.type === "D" ? "badge-assumption" : "badge-primary"}">${escapeHtml(confidenceText(source.type))}</span></p>
        <p>${escapeHtml(confidence[source.type] || "")}</p>
        <p class="source-detail">${escapeHtml(source.usedFor)}</p>
        <p class="source-detail">${escapeHtml(source.dateOrYear || "")}</p>
        ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer" class="source-link">View source</a>` : `<span class="muted-badge">Needs independent source</span>`}
      </details>
    `;
  }).join("");
}

const WA_NATIVE_LIBRARY = {
  Hindi: { greeting: "अरे सुनो", hook: "फ्रिज खाली और मूड पूरा फिल्मी?", punch: "आपके इलाके में झटपट डिलीवरी तैयार है", cta: "अभी टैप करो, वरना मम्मी वाला साइड-आई मिलेगा।", meme: "Local meme cue: mummy checking empty dabba" },
  Telugu: { greeting: "అరే బాబు", hook: "ఫ్రిజ్ ఖాళీ, క్రేవింగ్ మాత్రం ఫుల్ ఆన్?", punch: "మీ ఏరియాలో ఫాస్ట్ డెలివరీ రెడీ", cta: "ఇప్పుడే ట్యాప్ చేయండి, క్రేవింగ్ ఆగదు।", meme: "Local meme cue: last-minute chai break panic" },
  Tamil: { greeting: "வணக்கம் பாஸ்", hook: "fridge காலி, craving மட்டும் full-aa?", punch: "உங்க area-ல quick delivery ready", cta: "இப்போ tap பண்ணுங்க, பசிக்கு interval இல்ல.", meme: "Local meme cue: tea kadai-level craving" },
  Marathi: { greeting: "ऐका ना", hook: "फ्रिज रिकामा, पण craving full on?", punch: "तुमच्या भागात fast delivery ready आहे", cta: "आता tap करा, भूक wait करत नाही.", meme: "Local meme cue: dabba khali reaction" },
  Kannada: { greeting: "ಕೇಳ್ರಿ ಬಾಸ್", hook: "ಫ್ರಿಜ್ ಖಾಲಿ, craving ಮಾತ್ರ full?", punch: "ನಿಮ್ಮ ಏರಿಯಾದಲ್ಲಿ fast delivery ready ಇದೆ", cta: "ಈಗ tap ಮಾಡಿ, ಹಸಿವು wait ಮಾಡಲ್ಲ.", meme: "Local meme cue: traffic-signal patience vs instant snacks" },
  Malayalam: { greeting: "നോക്കൂ മച്ചാ", hook: "fridge കാലി, craving full power ആണോ?", punch: "നിങ്ങളുടെ area-യിൽ quick delivery ready", cta: "ഇപ്പോ tap ചെയ്യൂ, വിശപ്പ് wait ചെയ്യില്ല.", meme: "Local meme cue: tea-time emergency" },
  Odia: { greeting: "ଶୁଣ ଭାଇ", hook: "ଫ୍ରିଜ୍ ଖାଲି, craving full on?", punch: "ତୁମ area re fast delivery ready achhi", cta: "ଏବେ tap କର, ଭୋକ wait କରେନି.", meme: "Local meme cue: khaiba dabba check" },
  Punjabi: { greeting: "ਓ ਜੀ ਸੁਣੋ", hook: "fridge ਖਾਲੀ, craving full power?", punch: "ਤੁਹਾਡੇ area ਵਿੱਚ fast delivery ready aa", cta: "ਹੁਣ tap ਕਰੋ, craving ਨੂੰ wait ਨਾ ਕਰਾਓ.", meme: "Local meme cue: full-power hunger entry" },
  Haryanvi: { greeting: "सुण ले भाई", hook: "फ्रिज खाली, craving full power?", punch: "तेरे area में fast delivery ready se", cta: "अभी tap कर, भूख कोई meeting ना se.", meme: "Local meme cue: office meeting vs snack emergency" },
  English: { greeting: "Quick heads-up", hook: "empty fridge, full cravings?", punch: "Fast local delivery is ready in your area", cta: "Tap now before the snack debate starts.", meme: "Local meme cue: group chat deciding snacks forever" }
};

function getNativeCopy(language, cityName, category, offer) {
  const pack = WA_NATIVE_LIBRARY[language] || WA_NATIVE_LIBRARY.Hindi;
  const cat = category.toLowerCase();
  const offerLine = offer && offer !== "No discount / content-led test" && offer !== "No discount" ? ` ${offer} bhi hai.` : "";
  return {
    body: `${pack.greeting}! ${pack.hook} ${cat} ${cityName} mein ready hai.${offerLine} ${pack.punch}.`,
    cta: pack.cta,
    meme: pack.meme
  };
}

function nativeLanguagesForCity(city, selectedLanguage) {
  const cityLanguages = (city.languages || []).filter(lang => lang !== "English");
  return [...new Set([selectedLanguage, ...cityLanguages, "Hindi"].filter(Boolean))].slice(0, 3);
}

function renderWhatsAppPreviews(ctx) {
  const grid = $("waPreviewGrid");
  if (!grid) return;
  if (!ctx.city.city) {
    grid.innerHTML = `<p class="note">Select a city in the Opportunity Engine to preview native WhatsApp messages.</p>`;
    return;
  }

  const languages = nativeLanguagesForCity(ctx.city, ctx.language);
  const offer = ctx.caOffer || "No discount";
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  grid.innerHTML = languages.map(language => {
    const copy = getNativeCopy(language, ctx.city.city, ctx.category, offer);
    return `
      <div class="wa-phone">
        <div class="wa-topbar">
          <div class="wa-avatar">${escapeHtml(language.slice(0, 1))}</div>
          <div><strong>${escapeHtml(ctx.platform.name)}</strong><span>${escapeHtml(ctx.city.city)} · ${escapeHtml(language)}</span></div>
        </div>
        <div class="wa-chat">
          <div class="wa-bubble"><p>${escapeHtml(copy.body)}</p><p><strong>${escapeHtml(copy.cta)}</strong></p><span>${escapeHtml(time)}</span></div>
          <div class="wa-reply">😂 Send me the deal</div>
        </div>
        <div class="wa-meta"><span>Native language must be used</span><span>${escapeHtml(copy.meme)}</span></div>
        <p class="wa-review-note">Native-speaker review required before launch.</p>
      </div>
    `;
  }).join("");
}

function renderSocialCampaignPreview(ctx) {
  const target = $("socialCampaignPreview");
  if (!target) return;
  if (!ctx.city.city) {
    target.innerHTML = `<p class="note">Select a city to preview Instagram and YouTube campaign formats.</p>`;
    return;
  }
  const copy = getNativeCopy(ctx.language, ctx.city.city, ctx.category, ctx.caOffer || "Content-led test");
  const cat = ctx.category.toLowerCase();
  const cards = [
    {
      channel: "Instagram Reels",
      handle: "@quicklocal",
      hook: copy.body,
      format: "9:16 reel with meme opener, product flash, local CTA",
      kpi: "3-sec hold, saves, shares, profile taps, link CTR"
    },
    {
      channel: "Instagram Stories",
      handle: "Area story ad",
      hook: `${ctx.city.city} poll: ${cat} abhi chahiye ya baad mein?`,
      format: "Poll sticker + swipe/tap link + reply DM tag",
      kpi: "Tap-forward rate, poll response, link CTR, replies"
    },
    {
      channel: "YouTube Shorts",
      handle: "15 sec local short",
      hook: `Empty shelf to instant ${cat}: ${copy.cta}`,
      format: "Hook in 2 seconds, native caption, pinned tracked link",
      kpi: "Viewed vs swiped, CTR, engaged views, conversions"
    }
  ];
  target.innerHTML = cards.map(card => `
    <div class="social-card">
      <div class="social-card-top"><span>${escapeHtml(card.channel)}</span><strong>${escapeHtml(card.handle)}</strong></div>
      <div class="social-screen">
        <p>${escapeHtml(card.hook)}</p>
        <button type="button">${escapeHtml(copy.cta)}</button>
      </div>
      <div class="social-card-meta"><span>${escapeHtml(card.format)}</span><span>${escapeHtml(card.kpi)}</span></div>
    </div>
  `).join("");
}

function caGetContext() {
  const city = cityFor("citySelect");
  const language = $("languageSelect")?.value || "English";
  const category = $("categorySelect")?.value || "Grocery";
  const platform = getPlatforms().find(item => item.id === ($("scorerPlatformSelect")?.value || "blinkit")) || selectedPlatform();
  const objective = $("objectiveSelect")?.value || "";
  const channel = ($("channelSelect")?.value) || "";
  const caObjective = $("caObjective")?.value || "";
  const caChannel = $("caChannel")?.value || "";
  const caOffer = $("caOffer")?.value || "";
  const caTone = $("caTone")?.value || "Local";
  return { city, language, category, platform, objective, channel, caObjective, caChannel, caOffer, caTone };
}

function renderCampaignAutopilot() {
  const ctx = caGetContext();
  const bmBrand = bmSelectedBrand || $("scorerPlatformSelect")?.value;
  const bmDims = BM_DIMENSIONS[bmBrand];
  const result = calculateScore(ctx.city, ctx.language, ctx.category);
  const confidence = result.confidence || "D";

  const connections = [
    { label: "City", value: ctx.city.city || "Not selected", ok: !!ctx.city.city },
    { label: "Language", value: ctx.language, ok: true },
    { label: "Category", value: ctx.category, ok: true },
    { label: "Benchmark", value: ctx.platform.name, ok: true, bmBrand },
    { label: "OE Score", value: result.score ? `${result.score}/100` : "Not scored", ok: !!result.score },
    { label: "Confidence", value: confidence, ok: confidence !== "D", raw: confidence }
  ];

  $("caConnectionStatus").innerHTML = connections.map(c => `
    <div class="ca-connection-item">
      <div class="ca-connection-label">${escapeHtml(c.label)}</div>
      ${c.ok
        ? `<div class="ca-connection-value">${escapeHtml(c.value)}</div>`
        : `<div class="ca-connection-missing">${escapeHtml(c.value)}</div>`}
    </div>
  `).join("");

  renderCALocalization(ctx);
  renderWhatsAppPreviews(ctx);
  renderSocialCampaignPreview(ctx);
  renderCAChecklist(ctx, bmDims, confidence);
  renderCATrackingList();
  renderCAMeasurementTracker();
}

function renderCALocalization(ctx) {
  if (!ctx.city.city) {
    $("caLocalInfo").innerHTML = `<p class="note">Select a city and language in the Opportunity Engine to see localization context.</p>`;
    return;
  }
  const cityData = (seedData.cities || []).find(c => c.city === ctx.city.city) || {};
  const lang = ctx.language;
  const isVernacular = ["Telugu", "Tamil", "Marathi", "Kannada", "Malayalam", "Odia", "Punjabi", "Haryanvi"].includes(lang);
  const langConf = cityData.confidence || "D";
  const localRows = [
    { key: "Recommended language", val: lang, flag: isVernacular ? "Vernacular" : "English-supplemented", flagClass: langConf === "A" || langConf === "B" ? "confident" : "partial" },
    { key: "Direction", val: "LTR", flag: "", flagClass: "" },
    { key: "Culture context", val: cityData.notes || ctx.city.state || "No specific context available", flag: "", flagClass: "" },
    { key: "Localization confidence", val: langConf, flag: langConf === "D" ? "Unvalidated" : langConf === "C" ? "Partial" : "Source-backed", flagClass: langConf === "D" ? "unvalidated" : langConf === "C" ? "partial" : "confident" }
  ];
  if (langConf === "D") localRows.push({ key: "Note", val: "Language context requires validation.", flag: "", flagClass: "unvalidated" });

  $("caLocalInfo").innerHTML = localRows.map(r => `
    <div class="ca-local-row">
      <span class="ca-local-key">${escapeHtml(r.key)}</span>
      <span class="ca-local-val">${escapeHtml(r.val)}${r.flag ? `<span class="ca-local-flag ${r.flagClass}">${escapeHtml(r.flag)}</span>` : ""}</span>
    </div>
  `).join("");
}

function generateCampaignDraftStatic() {
  const ctx = caGetContext();
  if (!ctx.city.city) { $("caDrafts").innerHTML = `<p class="note">Select market first — choose a city in the Opportunity Engine.</p>`; return; }
  if (!ctx.caObjective) { $("caDrafts").innerHTML = `<p class="note">Select a campaign objective above to generate drafts.</p>`; return; }
  if (!ctx.caChannel) { $("caDrafts").innerHTML = `<p class="note">Select a channel above to generate drafts.</p>`; return; }

  const result = calculateScore(ctx.city, ctx.language, ctx.category);
  const confidence = result.confidence || "D";
  const bmBrand = bmSelectedBrand || $("scorerPlatformSelect")?.value;
  const bmDims = BM_DIMENSIONS[bmBrand];
  const platformName = ctx.platform.name;
  const cityName = ctx.city.city;
  const cat = ctx.category.toLowerCase();
  const obj = ctx.caObjective;
  const channel = ctx.caChannel;
  const offer = ctx.caOffer || "No discount";
  const tone = ctx.caTone;
  const isVernacular = ["Telugu", "Tamil", "Marathi", "Kannada", "Malayalam", "Odia", "Punjabi", "Haryanvi"].includes(ctx.language);
  const persona = CITY_PERSONA_MAP[cityName];
  const personaHook = persona?.hook || "10-minute delivery that fits local daily life.";

  let primary, short, cta, followup, reminder, unsubscribe;

  if (obj === "Awareness") {
    primary = `${personaHook} ${cat.charAt(0).toUpperCase() + cat.slice(1)} delivery is now live in ${cityName}. Explore available options near you.`;
    short = `${cat.charAt(0).toUpperCase() + cat.slice(1)} in ${cityName} — tap to explore.`;
    cta = "Explore now";
    followup = `Still looking for ${cat} options in ${cityName}? Here are this week's picks.`;
    reminder = `Your ${cat} delivery is available in ${cityName}. Open the app to browse.`;
  } else if (obj === "Trial" || obj === "Conversion") {
    primary = `${personaHook} Need ${cat} fast in ${cityName}? Try a quick local convenience run today. ${offer !== "No discount" ? offer + " for first orders." : ""}`.trim();
    short = `${cat.charAt(0).toUpperCase() + cat.slice(1)} in ${cityName} — first order offer inside.`;
    cta = "Order now";
    followup = `Your ${cat} order is a tap away. ${offer !== "No discount" ? offer + " still available." : "Fast delivery in your area."}`;
    reminder = `${cat.charAt(0).toUpperCase() + cat.slice(1)} delivery reminder — your offer expires soon.`;
  } else if (obj === "Retention" || obj === "Repeat purchase") {
    primary = `${personaHook} Welcome back. Your regular ${cat} order is ready to reorder in one tap.`;
    short = `Reorder your ${cat} essentials in ${cityName}.`;
    cta = "Reorder now";
    followup = `Haven't ordered ${cat} this week? Your usual items are in stock.`;
    reminder = `Your ${cat} replenishment window is open. Tap to reorder.`;
  } else if (obj === "Win-back") {
    primary = `It's been a while. Your ${cat} delivery in ${cityName} is still here — come back with a fresh offer.`;
    short = `We miss you — ${cat} delivery in ${cityName}, with a comeback offer.`;
    primary = `${personaHook} ${primary}`;
    cta = "Come back";
    followup = `Your local ${cat} selection has expanded. Browse what's new in ${cityName}.`;
    reminder = `Last chance — your win-back offer for ${cat} delivery expires today.`;
  } else {
    primary = `${cat.charAt(0).toUpperCase() + cat.slice(1)} delivery in ${cityName} — explore what's available near you.`;
    short = `${cat} delivery in ${cityName} — tap to explore.`;
    primary = `${personaHook} ${primary}`;
    cta = "Try now";
    followup = `More ${cat} options available in ${cityName} this week.`;
    reminder = `Your ${cat} delivery reminder for ${cityName}.`;
  }

  unsubscribe = "Reply STOP to opt out.";
  if (channel === "WhatsApp" || channel === "SMS") {
    unsubscribe = "Reply STOP to opt out of future messages.";
  } else if (channel === "Push notification" || channel === "In-app banner") {
    unsubscribe = "Manage notification preferences in app settings.";
  } else {
    unsubscribe = "Opt out through platform preferences.";
  }

  if (isVernacular) {
    primary += ` [${ctx.language} variant requires native-speaker review before launch]`;
  }

  const validationWarnings = [];
  if (confidence === "D") validationWarnings.push("Score confidence is D — decision-grade data is missing.");
  if (!bmDims) validationWarnings.push("Benchmark not selected — recommendations may lack precision.");
  if (cityFor("citySelect").confidence === "D") validationWarnings.push("City data is model assumption — requires validation.");

  caDraftData = {
    city: cityName,
    useCase: ctx.category,
    language: ctx.language,
    benchmark: platformName,
    objective: obj,
    channel,
    offer,
    tone,
    messageDrafts: { primary, short, cta, followup, reminder, unsubscribe },
    cityPersona: persona ? {
      hook: persona.hook,
      priceAngle: persona.priceAngle,
      topCategories: persona.topCategories,
      competitorGap: persona.competitorGap,
      localTrigger: persona.localTrigger
    } : null,
    score: result.score,
    confidence,
    validationWarnings,
    generatedAt: new Date().toISOString(),
    localization: { recommendedLanguage: ctx.language, direction: "LTR", confidence: ctx.city.confidence || "D" }
  };

  const fields = [
    { label: "Primary message", value: primary },
    { label: "Short version", value: short },
    { label: "CTA", value: cta },
    { label: "Follow-up message", value: followup },
    { label: "Reminder message", value: reminder },
    { label: "Unsubscribe line", value: unsubscribe },
    ...(persona ? [
      { label: "City trigger", value: persona.localTrigger },
      { label: "Price angle", value: persona.priceAngle },
      { label: "Competitor gap", value: persona.competitorGap }
    ] : [])
  ];

  $("caDrafts").innerHTML = fields.map(f => `
    <div class="ca-draft-field">
      <div class="ca-draft-field-label">${escapeHtml(f.label)}</div>
      <div class="ca-draft-field-value">${escapeHtml(f.value)}</div>
    </div>
  `).join("") + (validationWarnings.length ? `
    <div class="ca-draft-field" style="border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.06); border-radius: 10px; padding: 10px 14px;">
      <div class="ca-draft-field-label" style="color: var(--danger);">Validation warnings</div>
      <div class="ca-draft-field-value">${validationWarnings.map(w => `<div>${escapeHtml(w)}</div>`).join("")}</div>
    </div>
  ` : "");

  renderVernacularDraftVariant(ctx.language, caDraftData.messageDrafts, caDraftData);
  window._oeBriefData = window._oeBriefData || null;
}

async function generateCampaignDraft() {
  const ctx = caGetContext();
  if (!ctx.city.city) { $("caDrafts").innerHTML = `<p class="note">Select market first - choose a city in the Opportunity Engine.</p>`; return; }
  if (!ctx.caObjective) { $("caDrafts").innerHTML = `<p class="note">Select a campaign objective above to generate drafts.</p>`; return; }
  if (!ctx.caChannel) { $("caDrafts").innerHTML = `<p class="note">Select a channel above to generate drafts.</p>`; return; }

  $("caDrafts").innerHTML = `<p class="note">Generating AI campaign drafts from backend...</p>`;
  if ($("vernacularDraftOutput")) $("vernacularDraftOutput").innerHTML = `<p class="note">Waiting for backend localization...</p>`;

  const payload = {
    city: ctx.city.city,
    language: ctx.language,
    category: ctx.category,
    objective: ctx.caObjective,
    channel: ctx.caChannel,
    offer: ctx.caOffer,
    tone: ctx.caTone
  };

  try {
    const response = await postBackend("/campaign", payload);
    const primary = response.drafts?.[0]?.copy || "";
    const short = response.drafts?.[1]?.copy || "";
    const followup = response.drafts?.[2]?.copy || "";
    caDraftData = {
      city: payload.city,
      useCase: payload.category,
      language: payload.language,
      benchmark: ctx.platform.name,
      objective: payload.objective,
      channel: payload.channel,
      offer: payload.offer || "No discount",
      tone: payload.tone,
      messageDrafts: {
        primary,
        short,
        cta: response.cta || "Order now",
        followup,
        reminder: response.localization_note || "",
        unsubscribe: payload.channel === "WhatsApp" || payload.channel === "SMS" ? "Reply STOP to opt out of future messages." : "Manage notification preferences in app settings."
      },
      backend: response,
      validationWarnings: response.do_not_say || [],
      generatedAt: new Date().toISOString()
    };
    $("caDrafts").innerHTML = (response.drafts || []).map(draft => `
      <div class="ca-draft-field">
        <div class="ca-draft-field-label">${escapeHtml(draft.label)} · ${escapeHtml(draft.char_count)} chars</div>
        <div class="ca-draft-field-value">${escapeHtml(draft.copy)}</div>
      </div>
    `).join("") + `
      <div class="ca-draft-field">
        <div class="ca-draft-field-label">Do not say</div>
        <div class="ca-draft-field-value">${(response.do_not_say || []).map(item => escapeHtml(item)).join("<br>")}</div>
      </div>
    `;
    if ($("vernacularDraftLabel")) $("vernacularDraftLabel").textContent = `${payload.language} backend localization`;
    if ($("vernacularDraftOutput")) $("vernacularDraftOutput").innerHTML = `
      <div class="ca-draft-field">
        <div class="ca-draft-field-label">Localization note</div>
        <div class="ca-draft-field-value">${escapeHtml(response.localization_note || "Review final copy with a native speaker.")}</div>
      </div>
    `;
  } catch (error) {
    console.warn("Backend campaign failed; using static campaign draft.", error);
    generateCampaignDraftStatic();
  }
}

function renderVernacularDraftVariant(language, drafts, draftData) {
  const container = $("vernacularDraftOutput");
  const labelEl = $("vernacularDraftLabel");
  if (!container || !labelEl) return;

  const bank = VERNACULAR_PHRASE_BANK[language];
  if (!bank) {
    labelEl.textContent = "Vernacular draft";
    labelEl.classList.remove("warning");
    container.innerHTML = `<p class="note">No phrase bank is mapped for ${escapeHtml(language)} yet. Use the English draft and validate with a native speaker.</p>`;
    return;
  }

  labelEl.textContent = `${language} draft - ${bank.reviewed ? "reviewed phrase bank" : "native-speaker review needed"}`;
  labelEl.classList.toggle("warning", !bank.reviewed);

  const offer = draftData?.offer && draftData.offer !== "No discount" ? `Offer: ${draftData.offer}.` : bank.value;
  const lines = [
    bank.greeting,
    bank.urgency,
    offer,
    drafts?.primary || "",
    `CTA: ${bank.cta || drafts?.cta || "Order now"}`,
    bank.reviewed ? "Phrase bank reviewed; still check final brand/legal copy." : "Verify wording with a native speaker before launch."
  ].filter(Boolean);

  container.innerHTML = lines.map(line => `
    <div class="ca-draft-field">
      <div class="ca-draft-field-value">${escapeHtml(line)}</div>
    </div>
  `).join("");
}

async function copyCampaignDraft() {
  if (!caDraftData) { await generateCampaignDraft(); }
  if (!caDraftData) return;
  const drafts = caDraftData.messageDrafts;
  const text = [
    `Campaign Draft — ${caDraftData.city} / ${caDraftData.useCase} / ${caDraftData.channel}`,
    `Objective: ${caDraftData.objective}`,
    `Tone: ${caDraftData.tone}`,
    `Offer: ${caDraftData.offer}`,
    ``,
    `Primary: ${drafts.primary}`,
    `Short: ${drafts.short}`,
    `CTA: ${drafts.cta}`,
    `Follow-up: ${drafts.followup}`,
    `Reminder: ${drafts.reminder}`,
    `Unsubscribe: ${drafts.unsubscribe}`,
    ``,
    `Drafts — review before use.`
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    $("caCopyDraft").textContent = "Copied!";
    setTimeout(() => { $("caCopyDraft").textContent = "Copy English draft"; }, 2000);
  } catch(e) { console.warn("Clipboard write failed", e); }
}

function caAddToBrief() {
  if (!caDraftData) { generateCampaignDraftStatic(); }
  if (!caDraftData) return;
  if (!window._oeBriefData) { generateBriefStatic(); }
  if (!window._oeBriefData) return;

  const lens = `[Campaign: ${caDraftData.objective} via ${caDraftData.channel}] Primary: "${caDraftData.messageDrafts.primary}" CTA: "${caDraftData.messageDrafts.cta}"`;
  if (window._oeBriefData.caCampaignLens && window._oeBriefData.caCampaignLens.includes(caDraftData.objective + " via " + caDraftData.channel)) {
    $("caAddToBrief").textContent = "Already added";
    setTimeout(() => { $("caAddToBrief").textContent = "Add to campaign brief"; }, 2000);
    return;
  }
  window._oeBriefData.caCampaignLens = (window._oeBriefData.caCampaignLens || "") + lens + "\n";
  window._oeBriefData.channel = caDraftData.channel;
  window._oeBriefData.campaignObjective = caDraftData.objective;
  window._oeBriefData.messageDrafts = caDraftData.messageDrafts;
  window._oeBriefData.trackingMetrics = ["Delivered", "Opened", "Clicked", "Replied", "Converted", "Repeat purchase", "Unsubscribed", "Spend", "Revenue"];
  window._oeBriefData.metricResults = caMetrics || null;
  window._oeBriefData.validationWarnings = caDraftData.validationWarnings;
  window._oeBriefData.learningNote = localStorage.getItem("caLearningNote") || "";

  const briefEl = $("oeBrief");
  const existingCampaign = briefEl.querySelector("[data-ca-campaign]");
  if (existingCampaign) existingCampaign.remove();

  const campaignDiv = document.createElement("div");
  campaignDiv.setAttribute("data-ca-campaign", "true");
  campaignDiv.classList.add("oe-brief-field");
  campaignDiv.innerHTML = `<div class="oe-brief-field-label">Campaign Autopilot</div><div class="oe-brief-field-value">${escapeHtml(lens)}</div>`;
  briefEl.appendChild(campaignDiv);

  $("caAddToBrief").textContent = "Added to brief";
  setTimeout(() => { $("caAddToBrief").textContent = "Add to campaign brief"; }, 2000);
}

function exportCampaignJson() {
  if (!caDraftData) { generateCampaignDraftStatic(); }
  if (!caDraftData) return;
  const exportData = {
    ...caDraftData,
    benchmark: caDraftData.benchmark,
    trackingMetrics: caMetrics ? caMetrics : null,
    learningNote: localStorage.getItem("caLearningNote") || ""
  };
  if (window._oeBriefData) {
    exportData.briefCity = window._oeBriefData.city;
    exportData.briefCategory = window._oeBriefData.category;
    exportData.briefLanguage = window._oeBriefData.language;
    exportData.briefPlatform = window._oeBriefData.platform;
    exportData.briefBenchmark = window._oeBriefData.benchmark;
  }
  const json = JSON.stringify(exportData, null, 2);
  downloadText(`campaign-${caDraftData.city}-${caDraftData.useCase}-${caDraftData.channel.replace(/\s+/g, "-")}.json`, json, "application/json");
}

const CA_COLUMN_ALIASES = {
  sent: ["sent", "sends", "messages_sent", "total_sent"],
  delivered: ["delivered", "deliveries", "messages_delivered"],
  opened: ["opened", "opens", "open"],
  clicked: ["clicked", "clicks", "link_clicks", "ctr_clicks"],
  converted: ["converted", "conversions", "orders", "purchases"],
  repeat_purchases: ["repeat_purchases", "repeat_orders", "repeat", "repeat_orders_7d"],
  unsubscribed: ["unsubscribed", "opt_out", "stop", "unsubscribes"],
  spend: ["spend", "cost", "ad_spend", "amount_spent", "spend_inr"],
  revenue: ["revenue", "sales", "gmv", "order_value", "revenue_inr"],
  replied: ["replied", "replies", "reply", "responses"]
};

function detectColumnMapping(headers) {
  const mapping = {};
  const detected = {};
  const missing = [];
  const normalized = headers.map(h => h.toLowerCase().trim().replace(/[\s-]+/g, "_"));
  for (const [metricKey, aliases] of Object.entries(CA_COLUMN_ALIASES)) {
    let found = null;
    for (const alias of aliases) {
      const idx = normalized.indexOf(alias.toLowerCase());
      if (idx !== -1) {
        found = headers[idx];
        break;
      }
    }
    if (found) {
      mapping[metricKey] = found;
      detected[metricKey] = found;
    } else {
      missing.push(metricKey);
    }
  }
  return { mapping, detected, missing };
}

function sumCsvColumn(rows, mapping, key) {
  const colName = mapping[key];
  if (!colName) return null;
  return rows.reduce((sum, row) => {
    const val = Number(row[colName]);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

function calculateCAMetrics(rows, mapping) {
  const totals = {};
  for (const key of Object.keys(CA_COLUMN_ALIASES)) {
    totals[key] = sumCsvColumn(rows, mapping, key);
  }

  const has = (key) => mapping[key] != null;
  const val = (key) => totals[key];
  const label = (key) => CA_COLUMN_ALIASES[key][0];

  function missingMsg(keys) {
    return keys.filter(k => !has(k)).map(k => label(k));
  }

  const metrics = [];

  // Delivery Rate = delivered / sent
  {
    const missing = missingMsg(["delivered", "sent"]);
    const num = val("delivered");
    const den = val("sent");
    if (missing.length) {
      metrics.push({ name: "Delivery Rate", calc: "delivered / sent", value: "Not calculable \u2014 missing column: " + missing.join(", "), available: false });
    } else if (den === 0) {
      metrics.push({ name: "Delivery Rate", calc: "delivered / sent", value: "Not calculable \u2014 denominator is zero", available: false });
    } else {
      metrics.push({ name: "Delivery Rate", calc: "delivered / sent", value: (num / den * 100).toFixed(1) + "%", available: true });
    }
  }

  // Open Rate = opened / delivered
  {
    const missing = missingMsg(["opened", "delivered"]);
    const num = val("opened");
    const den = val("delivered");
    if (missing.length) {
      metrics.push({ name: "Open Rate", calc: "opened / delivered", value: "Not calculable \u2014 missing column: " + missing.join(", "), available: false });
    } else if (den === 0) {
      metrics.push({ name: "Open Rate", calc: "opened / delivered", value: "Not calculable \u2014 denominator is zero", available: false });
    } else {
      metrics.push({ name: "Open Rate", calc: "opened / delivered", value: (num / den * 100).toFixed(1) + "%", available: true });
    }
  }

  // CTR = clicked / delivered, or clicked / opened if delivered unavailable
  {
    let calc, num, den, missing;
    if (has("delivered")) {
      calc = "clicked / delivered";
      missing = missingMsg(["clicked", "delivered"]);
      num = val("clicked");
      den = val("delivered");
    } else if (has("opened")) {
      calc = "clicked / opened (delivered unavailable)";
      missing = missingMsg(["clicked"]);
      num = val("clicked");
      den = val("opened");
    } else {
      calc = "clicked / delivered";
      missing = ["delivered", "opened"];
      num = null;
      den = null;
    }
    if (missing.length) {
      metrics.push({ name: "CTR", calc, value: "Not calculable \u2014 missing column: " + missing.join(", "), available: false });
    } else if (den === 0) {
      metrics.push({ name: "CTR", calc, value: "Not calculable \u2014 denominator is zero", available: false });
    } else {
      metrics.push({ name: "CTR", calc, value: (num / den * 100).toFixed(1) + "%", available: true });
    }
  }

  // Reply Rate = replied / delivered
  {
    const missing = missingMsg(["replied", "delivered"]);
    const num = val("replied");
    const den = val("delivered");
    if (missing.length) {
      metrics.push({ name: "Reply Rate", calc: "replied / delivered", value: "Not calculable \u2014 missing column: " + missing.join(", "), available: false });
    } else if (den === 0) {
      metrics.push({ name: "Reply Rate", calc: "replied / delivered", value: "Not calculable \u2014 denominator is zero", available: false });
    } else {
      metrics.push({ name: "Reply Rate", calc: "replied / delivered", value: (num / den * 100).toFixed(1) + "%", available: true });
    }
  }

  // CVR = converted / clicked
  {
    const missing = missingMsg(["converted", "clicked"]);
    const num = val("converted");
    const den = val("clicked");
    if (missing.length) {
      metrics.push({ name: "CVR", calc: "converted / clicked", value: "Not calculable \u2014 missing column: " + missing.join(", "), available: false });
    } else if (den === 0) {
      metrics.push({ name: "CVR", calc: "converted / clicked", value: "Not calculable \u2014 denominator is zero", available: false });
    } else {
      metrics.push({ name: "CVR", calc: "converted / clicked", value: (num / den * 100).toFixed(1) + "%", available: true });
    }
  }

  // Repeat Rate = repeat_purchases / converted
  {
    const missing = missingMsg(["repeat_purchases", "converted"]);
    const num = val("repeat_purchases");
    const den = val("converted");
    if (missing.length) {
      metrics.push({ name: "Repeat Rate", calc: "repeat_purchases / converted", value: "Not calculable \u2014 missing column: " + missing.join(", "), available: false });
    } else if (den === 0) {
      metrics.push({ name: "Repeat Rate", calc: "repeat_purchases / converted", value: "Not calculable \u2014 denominator is zero", available: false });
    } else {
      metrics.push({ name: "Repeat Rate", calc: "repeat_purchases / converted", value: (num / den * 100).toFixed(1) + "%", available: true });
    }
  }

  // Unsubscribe Rate = unsubscribed / delivered
  {
    const missing = missingMsg(["unsubscribed", "delivered"]);
    const num = val("unsubscribed");
    const den = val("delivered");
    if (missing.length) {
      metrics.push({ name: "Unsubscribe Rate", calc: "unsubscribed / delivered", value: "Not calculable \u2014 missing column: " + missing.join(", "), available: false });
    } else if (den === 0) {
      metrics.push({ name: "Unsubscribe Rate", calc: "unsubscribed / delivered", value: "Not calculable \u2014 denominator is zero", available: false });
    } else {
      metrics.push({ name: "Unsubscribe Rate", calc: "unsubscribed / delivered", value: (num / den * 100).toFixed(1) + "%", available: true });
    }
  }

  // CAC Proxy = spend / converted
  {
    const missing = missingMsg(["spend", "converted"]);
    const num = val("spend");
    const den = val("converted");
    if (missing.length) {
      metrics.push({ name: "CAC Proxy", calc: "spend / converted", value: "Not calculable \u2014 missing column: " + missing.join(", "), available: false });
    } else if (den === 0) {
      metrics.push({ name: "CAC Proxy", calc: "spend / converted", value: "Not calculable \u2014 denominator is zero", available: false });
    } else {
      metrics.push({ name: "CAC Proxy", calc: "spend / converted", value: "INR " + formatNumber(Math.round(num / den)), available: true });
    }
  }

  // ROAS = revenue / spend
  {
    const missing = missingMsg(["revenue", "spend"]);
    const num = val("revenue");
    const den = val("spend");
    if (missing.length) {
      metrics.push({ name: "ROAS", calc: "revenue / spend", value: "Not calculable \u2014 missing column: " + missing.join(", "), available: false });
    } else if (den === 0) {
      metrics.push({ name: "ROAS", calc: "revenue / spend", value: "Not calculable \u2014 denominator is zero", available: false });
    } else {
      metrics.push({ name: "ROAS", calc: "revenue / spend", value: (num / den).toFixed(2) + "x", available: true });
    }
  }

  const calculableCount = metrics.filter(m => m.available).length;
  const notCalculableCount = metrics.length - calculableCount;

  return { totals, metrics, calculableCount, notCalculableCount };
}

function renderCAMeasurementTracker() {
  if (!caCsvData) {
    $("caTrackerEmpty").classList.remove("hidden");
    $("caTrackerDashboard").classList.add("hidden");
    return;
  }
  $("caTrackerEmpty").classList.add("hidden");
  $("caTrackerDashboard").classList.remove("hidden");

  if (!caColumnMapping) {
    caColumnMapping = detectColumnMapping(Object.keys(caCsvData[0] || {}));
  }

  const result = calculateCAMetrics(caCsvData, caColumnMapping.mapping);
  caMetrics = result;
  pilotCampaignUploaded = true;

  const rowCount = caCsvData.length;
  const headerList = Object.keys(caCsvData[0] || {});
  const detectedColNames = Object.values(caColumnMapping.detected);
  const allMetricKeys = Object.keys(CA_COLUMN_ALIASES);
  const mappedCount = allMetricKeys.filter(k => caColumnMapping.mapping[k]).length;

  $("caTrackerStatus").innerHTML = `
    <div class="ca-status-row">
      <span class="ca-status-success">&#10003; CSV imported successfully</span>
      <span class="ca-status-stat">${rowCount} row${rowCount !== 1 ? "s" : ""} detected</span>
      <span class="ca-status-stat">${result.calculableCount} metric${result.calculableCount !== 1 ? "s" : ""} calculable</span>
      ${result.notCalculableCount > 0 ? `<span class="ca-status-warning">${result.notCalculableCount} metric${result.notCalculableCount !== 1 ? "s" : ""} need column mapping</span>` : ""}
    </div>
  `;

  $("caMetricsKpis").innerHTML = result.metrics.map(m => `
    <article class="kpi-card${m.available ? "" : " kpi-card--not-calculable"}">
      <div class="kpi-label">${escapeHtml(m.name)}</div>
      <div class="kpi-value${m.available ? "" : " kpi-value--warning"}">${escapeHtml(m.value)}</div>
      <div class="kpi-caption">${escapeHtml(m.calc)}</div>
    </article>
  `).join("");

  $("caColumnMappingContent").innerHTML = `
    <div class="ca-mapping-header">Columns detected in CSV: ${headerList.map(h => escapeHtml(h)).join(", ")}</div>
    ${allMetricKeys.map(key => {
      const mappedCol = caColumnMapping.mapping[key];
      const canonicalName = CA_COLUMN_ALIASES[key][0];
      return `<div class="ca-formula-row">
        <span class="ca-formula-name">${escapeHtml(canonicalName)}</span>
        <span class="ca-formula-calc">${mappedCol ? escapeHtml(mappedCol) : "Not mapped"}</span>
      </div>`;
    }).join("")}
  `;

  $("caFormulas").innerHTML = result.metrics.map(m => `
    <div class="ca-formula-row"><span class="ca-formula-name">${escapeHtml(m.name)}</span><span class="ca-formula-calc">${escapeHtml(m.calc)}</span></div>
  `).join("");
}

function renderCAChecklist(ctx, bmDims, confidence) {
  const items = [
    { label: "Market selected", ok: !!ctx.city.city, status: ctx.city.city ? "ready" : "missing" },
    { label: "Benchmark selected", ok: !!bmDims, status: bmDims ? "ready" : "missing" },
    { label: "Language context available", ok: true, status: (ctx.city.confidence || "D") === "D" ? "needs-validation" : "ready" },
    { label: "Campaign objective selected", ok: !!ctx.caObjective, status: ctx.caObjective ? "ready" : "missing" },
    { label: "Message draft generated", ok: !!caDraftData, status: caDraftData ? "ready" : "missing" },
    { label: "Tracking metrics identified", ok: true, status: "ready" },
    { label: "CSV uploaded", ok: !!caCsvData, status: caCsvData ? "ready" : "missing" },
    { label: "Evidence confidence acceptable", ok: confidence !== "D", status: confidence === "D" ? "needs-validation" : "ready" }
  ];
  $("caChecklist").innerHTML = items.map(it => {
    const icon = it.status === "ready" ? "✓" : it.status === "needs-validation" ? "!" : "—";
    const text = it.status === "ready" ? it.label : it.status === "needs-validation" ? `${it.label} — needs validation` : `${it.label} — missing`;
    return `<div class="ca-checklist-item"><span class="ca-check-icon ${it.status}">${icon}</span><span class="ca-check-text">${escapeHtml(text)}</span></div>`;
  }).join("");
}

function renderCATrackingList() {
  const metrics = ["Delivered", "Opened", "Clicked", "Replied", "Converted", "Repeat purchase", "Unsubscribed", "Spend", "Revenue"];
  $("caTrackingMetrics").innerHTML = metrics.map(m => `
    <div class="ca-tracking-item"><span class="ca-tracking-dot"></span>${escapeHtml(m)}</div>
  `).join("");
}

function resetCampaign() {
  caDraftData = null;
  caCsvData = null;
  caColumnMapping = null;
  caMetrics = null;
  $("caObjective").value = "";
  $("caChannel").value = "";
  $("caOffer").value = "";
  $("caTone").value = "Local";
  $("caCsvUpload").value = "";
  $("caLearningNote").value = "";
  $("caDrafts").innerHTML = `<p class="note">Configure your campaign above, then generate drafts.</p>`;
  if ($("vernacularDraftLabel")) $("vernacularDraftLabel").textContent = "Vernacular draft";
  if ($("vernacularDraftOutput")) $("vernacularDraftOutput").innerHTML = `<p class="note">Generate a campaign draft to see the language variant.</p>`;
  $("caTrackerEmpty").classList.remove("hidden");
  $("caTrackerDashboard").classList.add("hidden");
  const colMapping = $("caColumnMapping");
  if (colMapping) colMapping.classList.add("hidden");
  renderCampaignAutopilot();
}

function resetCsvData() {
  caCsvData = null;
  caColumnMapping = null;
  caMetrics = null;
  $("caCsvUpload").value = "";
  $("caTrackerEmpty").classList.remove("hidden");
  $("caTrackerDashboard").classList.add("hidden");
  const colMapping = $("caColumnMapping");
  if (colMapping) colMapping.classList.add("hidden");
  renderCampaignAutopilot();
}

function videoGetContext() {
  const city = cityFor("videoCitySelect");
  const language = $("videoLanguageSelect")?.value || "Hindi";
  const category = $("videoCategorySelect")?.value || "Grocery";
  const platform = getPlatforms().find(item => item.id === ($("videoPlatformSelect")?.value || "blinkit")) || selectedPlatform();
  const format = $("videoFormatSelect")?.value || "Instagram Reel";
  const manager = $("videoManagerSelect")?.value || "Area manager";
  return { city, language, category, platform, format, manager };
}

function videoSampleRows(ctx) {
  const base = categoryProfile(ctx.category).whatsappConversionFit || 7;
  const density = Number(ctx.city.quickCommerceDensity || 6);
  return [
    { segment: "New viewers", reached: 4200 + density * 180, watched: 2600 + base * 140, clicked: 240 + base * 18, orders: 38 + base, note: "Hook test audience" },
    { segment: "Repeat viewers", reached: 1800 + density * 120, watched: 1380 + base * 90, clicked: 190 + base * 16, orders: 52 + base, note: "Retarget with stronger CTA" },
    { segment: "WhatsApp responders", reached: 620 + density * 40, watched: 520 + base * 45, clicked: 118 + base * 10, orders: 44 + base, note: "Warm lead list" },
    { segment: "High intent pin codes", reached: 950 + density * 70, watched: 760 + base * 55, clicked: 140 + base * 12, orders: 48 + base, note: "Manager should send more videos" }
  ];
}

function renderVideoCampaignStudio() {
  if (!$("videoBlueprint")) return;
  const ctx = videoGetContext();
  const copy = getNativeCopy(ctx.language, ctx.city.city || "selected city", ctx.category, "Content-led offer");
  const cat = ctx.category.toLowerCase();
  const rows = videoSampleRows(ctx);
  const maxCtr = Math.max(...rows.map(row => row.clicked / row.reached));

  renderVideoPlatformOutputs(ctx, copy);

  $("videoBlueprint").innerHTML = [
    ["Native hook", copy.body],
    ["Local meme angle", copy.meme],
    ["3-second opener", `Show the empty ${cat} shelf, then cut to a funny "${ctx.language} panic" reaction.`],
    ["Middle beat", `Area-specific proof: ${ctx.city.city || "selected city"} delivery, category availability, and one clear product shot.`],
    ["CTA", `${copy.cta} Use tracked link, UTM, and WhatsApp reply tag.`],
    ["Manager action", `${ctx.manager} checks CTR by segment and sends more videos to high-intent pin codes.`]
  ].map(([label, value]) => `<div class="video-blueprint-row"><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>`).join("");

  $("videoStoryboard").innerHTML = `
    <div class="reel-frame">
      <div class="reel-top">${escapeHtml(ctx.format)} · ${escapeHtml(ctx.platform.name)}</div>
      <div class="reel-scene active"><strong>0-3s</strong><p>${escapeHtml(copy.body)}</p></div>
      <div class="reel-scene"><strong>4-8s</strong><p>${escapeHtml(ctx.city.city || "Local")} ${escapeHtml(cat)} delivery: problem, product, proof.</p></div>
      <div class="reel-scene"><strong>9-15s</strong><p>${escapeHtml(copy.cta)} Track click, reply, order, repeat.</p></div>
      <div class="reel-caption">Designed for future Whisperflow scripts and autonomous reel-agent generation.</div>
    </div>
    <div class="video-creative-lab">
      <div class="video-lab-card hot"><span>Hook A</span><strong>Empty shelf panic</strong><p>Best for impulse snacks, dairy, household refills.</p></div>
      <div class="video-lab-card"><span>Hook B</span><strong>Area manager dare</strong><p>Local face says: beat this delivery time.</p></div>
      <div class="video-lab-card"><span>Hook C</span><strong>Meme reaction cut</strong><p>Native punchline first, product proof second.</p></div>
    </div>
  `;

  $("videoCtrGraph").innerHTML = `
    <div class="video-bars">
      ${rows.map(row => {
        const ctr = row.clicked / row.reached;
        const width = Math.max(10, (ctr / maxCtr) * 100);
        return `<div class="video-bar-row">
          <span>${escapeHtml(row.segment)}</span>
          <div class="video-bar-track"><div class="video-bar-fill" style="width:${width}%"></div></div>
          <strong>${(ctr * 100).toFixed(1)}%</strong>
        </div>`;
      }).join("")}
    </div>
    <p class="video-graph-note">CTR = clicks / reached. Replace sample rows with real user event data before claiming performance.</p>
  `;

  const checklist = [
    "Every reel has campaign_id, creative_id, city, pin_code, language, category, manager_id.",
    "Track reached, 3-second views, 50% views, full views, clicks, WhatsApp replies, orders, repeat orders.",
    "CTR is checked by language and pin code, not only campaign average.",
    "Area manager reviews high-click/low-order segments for stock, price, or serviceability issues.",
    "Native-language script is reviewed by a local speaker before publishing.",
    "Autonomous reel agent receives only approved brand claims, product shots, and CTA rules."
  ];
  $("videoChecklist").innerHTML = checklist.map(item => `<div class="video-check-item"><span>✓</span><p>${escapeHtml(item)}</p></div>`).join("");

  $("videoUserDatabase").innerHTML = `
    <table>
      <thead><tr><th>User segment</th><th>Reached</th><th>Watched</th><th>Clicked</th><th>Orders</th><th>Manager decision</th></tr></thead>
      <tbody>${rows.map(row => {
        const ctr = row.clicked / row.reached;
        const decision = ctr > 0.08 ? "Send more native videos" : ctr > 0.05 ? "Retarget with stronger hook" : "Rewrite hook and test meme angle";
        return `<tr><td>${escapeHtml(row.segment)}</td><td>${formatNumber(row.reached)}</td><td>${formatNumber(row.watched)}</td><td>${formatNumber(row.clicked)}</td><td>${formatNumber(row.orders)}</td><td>${escapeHtml(decision)}</td></tr>`;
      }).join("")}</tbody>
    </table>
  `;

  $("videoAgentPlan").innerHTML = [
    ["Whisperflow input", "Voice note from area manager: local insight, offer, objection, and language direction."],
    ["Agent output", "Native reel script, shot list, caption, thumbnail text, UTM campaign metadata."],
    ["Human gate", "Manager approves local humor, compliance, stock promise, and brand-safe claims."],
    ["Feedback loop", "CTR and order data decide which pin codes get more reel variations."]
  ].map(([label, value]) => `<div class="video-agent-step"><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>`).join("");
}

function renderVideoPlatformOutputs(ctx, copy) {
  const target = $("videoPlatformOutputs");
  if (!target) return;
  const cityName = ctx.city.city || "Local area";
  const cat = ctx.category.toLowerCase();
  const outputs = [
    {
      platform: "Instagram Reel",
      className: "instagram",
      duration: "0:15",
      handle: "@hyperlocal_bharat",
      caption: `${copy.cta} #${cityName.replace(/\s+/g, "")}Deals`,
      hook: copy.body,
      kpi: "Watch hold + profile taps + link CTR"
    },
    {
      platform: "YouTube Short",
      className: "youtube",
      duration: "0:18",
      handle: "Bharat Hyperlocal Shorts",
      caption: `Fast ${cat} delivery in ${cityName}`,
      hook: `Empty shelf to instant ${cat}: ${copy.cta}`,
      kpi: "Viewed vs swiped + pinned-link CTR"
    },
    {
      platform: "WhatsApp Status",
      className: "whatsapp",
      duration: "0:12",
      handle: `${cityName} broadcast list`,
      caption: "Reply 😂 for the deal",
      hook: copy.body,
      kpi: "Status views + replies + tracked clicks"
    }
  ];

  target.innerHTML = outputs.map((item, index) => `
    <div class="video-output-phone ${item.className}">
      <div class="video-output-header">
        <span>${escapeHtml(item.platform)}</span>
        <strong>${escapeHtml(item.duration)}</strong>
      </div>
      <div class="video-output-screen">
        <div class="video-output-bg"></div>
        <img class="video-output-product product-one" src="assets/hero/items/grocery-item-08.png" alt="" />
        <img class="video-output-product product-two" src="assets/hero/items/grocery-item-10.png" alt="" />
        <img class="video-output-product product-three" src="assets/hero/items/grocery-item-06.png" alt="" />
        <div class="video-output-copy">
          <span>${escapeHtml(item.handle)}</span>
          <h4>${escapeHtml(item.hook)}</h4>
          <p>${escapeHtml(item.caption)}</p>
        </div>
        <div class="video-output-playbar"><i style="animation-delay:${index * -1.2}s"></i></div>
      </div>
      <div class="video-output-footer">
        <span>${escapeHtml(item.kpi)}</span>
      </div>
    </div>
  `).join("");
}

const GEO_CITY_CENTERS = {
  Bengaluru: [77.5946, 12.9716],
  Hyderabad: [78.4867, 17.385],
  Chennai: [80.2707, 13.0827],
  Pune: [73.8567, 18.5204],
  Gurgaon: [77.0266, 28.4595],
  Vizag: [83.2185, 17.6868],
  Coimbatore: [76.9558, 11.0168],
  Nagpur: [79.0882, 21.1458],
  Kochi: [76.2673, 9.9312],
  Bhubaneswar: [85.8245, 20.2961],
  Ludhiana: [75.8573, 30.901],
  Mysuru: [76.6394, 12.2958]
};

function geoContext() {
  const city = cityFor("geoCitySelect");
  return {
    city,
    range: $("geoRangeSelect")?.value || "daily",
    metric: $("geoMetricSelect")?.value || "sales",
    channel: $("geoChannelSelect")?.value || "All channels"
  };
}

function geoAreaRows(ctx) {
  const center = GEO_CITY_CENTERS[ctx.city.city] || [77.5946, 12.9716];
  const density = Number(ctx.city.quickCommerceDensity || 6);
  const names = ["Central cluster", "North zone", "South zone", "East pocket", "West pocket", "High-intent society belt"];
  const rangeMultiplier = { daily: 1, weekly: 6.4, three_month: 82, six_month: 164 }[ctx.range] || 1;
  return names.map((name, index) => {
    const angle = (index / names.length) * Math.PI * 2;
    const radius = 0.018 + index * 0.006;
    const sales = Math.round((42000 + density * 5200 + index * 7400) * rangeMultiplier);
    const orders = Math.round((160 + density * 18 + index * 24) * rangeMultiplier);
    const ctr = Number((4.2 + density * 0.35 + index * 0.52).toFixed(1));
    const repeat = Number((18 + density * 1.4 + index * 1.8).toFixed(1));
    return {
      id: `${ctx.city.city}-${index}`,
      area: name,
      lng: center[0] + Math.cos(angle) * radius,
      lat: center[1] + Math.sin(angle) * radius,
      sales,
      orders,
      ctr,
      repeat,
      topAudience: ["Students", "Young professionals", "Families", "Office clusters", "Premium societies", "Repeat buyers"][index],
      action: ctr >= 7 ? "Scale Instagram + YouTube videos" : sales > 100000 ? "Add WhatsApp retargeting" : "Test funnier native hook"
    };
  });
}

function geoFeatureCollection(rows, metric = "sales") {
  const max = Math.max(...rows.map(row => metricValue(row, metric)));
  return {
    type: "FeatureCollection",
    features: rows.map(row => ({
      type: "Feature",
      properties: { ...row, metric_score: Math.max(0.1, metricValue(row, metric) / Math.max(1, max)) },
      geometry: { type: "Point", coordinates: [row.lng, row.lat] }
    }))
  };
}

function metricValue(row, metric) {
  if (metric === "orders") return row.orders;
  if (metric === "ctr") return row.ctr;
  if (metric === "repeat") return row.repeat;
  return row.sales;
}

function metricLabel(metric, value) {
  if (metric === "sales") return `INR ${formatNumber(value)}`;
  if (metric === "orders") return `${formatNumber(value)} orders`;
  return `${value}%`;
}

async function loadMapLibreAssets() {
  if (window.maplibregl) return true;
  if (!document.querySelector("[data-maplibre-css]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.css";
    link.dataset.maplibreCss = "true";
    document.head.appendChild(link);
  }
  return new Promise(resolve => {
    const existing = document.querySelector("[data-maplibre-script]");
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js";
    script.dataset.maplibreScript = "true";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function loadGeoLiveData() {
  try {
    const response = await fetch(`data/live_area_metrics.json?ts=${Date.now()}`);
    if (response.ok) geoLiveData = await response.json();
  } catch {
    geoLiveData = null;
  }
}

function renderGeoFallbackMap(rows, ctx) {
  const max = Math.max(...rows.map(row => metricValue(row, ctx.metric)));
  $("geoMap").innerHTML = `<div class="geo-fallback-map">
    ${rows.map((row, index) => {
      const value = metricValue(row, ctx.metric);
      const size = 54 + (value / max) * 64;
      const left = 16 + (index % 3) * 31;
      const top = 16 + Math.floor(index / 3) * 34;
      return `<button class="geo-bubble" type="button" style="width:${size}px;height:${size}px;left:${left}%;top:${top}%;" data-area="${escapeHtml(row.area)}">
        <strong>${escapeHtml(row.area.split(" ")[0])}</strong><span>${escapeHtml(metricLabel(ctx.metric, value))}</span>
      </button>`;
    }).join("")}
  </div>`;
}

async function renderGeoMap(rows, ctx) {
  const status = $("geoMapStatus");
  const mapEl = $("geoMap");
  if (!status || !mapEl) return;
  const hasMapLibre = await loadMapLibreAssets();
  const center = GEO_CITY_CENTERS[ctx.city.city] || [77.5946, 12.9716];
  const data = geoFeatureCollection(rows, ctx.metric);

  if (!hasMapLibre) {
    status.innerHTML = `<span class="geo-status-warning">MapLibre CDN unavailable. Showing local interactive 3D-style fallback map.</span>`;
    renderGeoFallbackMap(rows, ctx);
    return;
  }

  status.innerHTML = `<span class="geo-status-live">MapLibre real-world layer active</span><span>GeoJSON source updates on refresh/poll.</span>`;
  if (!geoMapInstance || geoMapLoadedForCity !== ctx.city.city) {
    mapEl.innerHTML = "";
    geoMapLoadedForCity = ctx.city.city;
    geoMapInstance = new window.maplibregl.Map({
      container: "geoMap",
      center,
      zoom: 11,
      pitch: 58,
      bearing: -18,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "OpenStreetMap contributors"
          }
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }]
      }
    });
    geoMapInstance.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    geoMapInstance.on("load", () => updateGeoMapSource(data, ctx));
  } else {
    updateGeoMapSource(data, ctx);
  }
}

function updateGeoMapSource(data, ctx) {
  if (!geoMapInstance || !geoMapInstance.loaded()) return;
  const metric = ctx.metric;
  if (!geoMapInstance.getSource("areas")) {
    geoMapInstance.addSource("areas", { type: "geojson", data });
    geoMapInstance.addLayer({
      id: "area-heat",
      type: "circle",
      source: "areas",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "metric_score"], 0, 12, 1, 52],
        "circle-color": ["interpolate", ["linear"], ["get", "metric_score"], 0, "#60a5fa", 0.55, "#fbbf24", 1, "#34d399"],
        "circle-opacity": 0.72,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1
      }
    });
    geoMapInstance.on("click", "area-heat", event => {
      const p = event.features?.[0]?.properties;
      if (!p) return;
      new window.maplibregl.Popup()
        .setLngLat(event.lngLat)
        .setHTML(`<strong>${escapeHtml(p.area)}</strong><br>${escapeHtml(metricLabel(metric, Number(p[metric])))}<br>${escapeHtml(p.action)}`)
        .addTo(geoMapInstance);
    });
  } else {
    geoMapInstance.getSource("areas").setData(data);
    geoMapInstance.setPaintProperty("area-heat", "circle-radius", ["interpolate", ["linear"], ["get", "metric_score"], 0, 12, 1, 52]);
    geoMapInstance.setPaintProperty("area-heat", "circle-color", ["interpolate", ["linear"], ["get", "metric_score"], 0, "#60a5fa", 0.55, "#fbbf24", 1, "#34d399"]);
  }
}

async function renderGeoSalesCommandCenter() {
  if (!$("geoAreaPanel")) return;
  const ctx = geoContext();
  await loadGeoLiveData();
  const liveRows = geoLiveData?.areas?.filter(row => row.city === ctx.city.city) || [];
  const rows = liveRows.length ? liveRows : geoAreaRows(ctx);
  const sorted = [...rows].sort((a, b) => metricValue(b, ctx.metric) - metricValue(a, ctx.metric));
  const top = sorted[0];

  $("geoAreaPanel").innerHTML = `
    <div class="geo-command-strip">
      <div><span>Sales AM</span><strong>${escapeHtml(top.area)}</strong><p>Push stock + offers where demand is already warm.</p></div>
      <div><span>Marketing AM</span><strong>${escapeHtml(top.topAudience)}</strong><p>Send more native video variants to the best-clicking group.</p></div>
    </div>
    <div class="geo-decision-hero"><span>Top area</span><strong>${escapeHtml(top.area)}</strong><p>${escapeHtml(metricLabel(ctx.metric, metricValue(top, ctx.metric)))} · ${escapeHtml(top.action)}</p></div>
    ${sorted.map(row => `<div class="geo-area-row"><span>${escapeHtml(row.area)}</span><strong>${escapeHtml(metricLabel(ctx.metric, metricValue(row, ctx.metric)))}</strong><p>${escapeHtml(row.topAudience)} · ${escapeHtml(row.action)}</p></div>`).join("")}
  `;

  renderGeoTrendGraph(sorted, ctx);
  renderGeoAudienceGraph(sorted);
  await renderGeoMap(sorted, ctx);
}

function renderGeoTrendGraph(rows, ctx) {
  const periods = ["Daily", "Weekly", "3 month", "6 month"];
  const base = rows.reduce((sum, row) => sum + row.sales, 0) / Math.max(1, rows.length);
  const values = [base / 30, base / 4, base * 3, base * 6].map(Math.round);
  const max = Math.max(...values);
  $("geoTrendGraph").innerHTML = periods.map((period, index) => `
    <div class="geo-trend-row"><span>${period}</span><div class="geo-trend-track"><div style="width:${(values[index] / max) * 100}%"></div></div><strong>INR ${formatNumber(values[index])}</strong></div>
  `).join("");
}

function renderGeoAudienceGraph(rows) {
  const audiences = rows.map(row => ({ label: row.topAudience, ctr: row.ctr })).sort((a, b) => b.ctr - a.ctr);
  const max = Math.max(...audiences.map(item => item.ctr));
  $("geoAudienceGraph").innerHTML = audiences.map(item => `
    <div class="geo-trend-row"><span>${escapeHtml(item.label)}</span><div class="geo-trend-track"><div style="width:${(item.ctr / max) * 100}%"></div></div><strong>${item.ctr}%</strong></div>
  `).join("");
}

const SHELLY_LANG = {
  English: { code: "en-IN", greeting: "Hi, I am Shelly. I am here.", prefix: "Shelly here.", fallback: "Ask me about score, sales area, video CTR, news signals, or say take me to a tab." },
  Hindi: { code: "hi-IN", greeting: "नमस्ते, मैं शेली हूँ। बोलिए।", prefix: "शेली बोल रही हूँ।", fallback: "आप score, sales area, video CTR, news signals पूछ सकते हैं, या किसी tab पर जाने को कह सकते हैं।" },
  Telugu: { code: "te-IN", greeting: "నమస్తే, నేను షెల్లీ. చెప్పండి.", prefix: "షెల్లీ ఇక్కడ ఉంది.", fallback: "Score, sales area, video CTR, news signals గురించి అడగండి, లేదా tab కి తీసుకెళ్ళమని చెప్పండి." },
  Tamil: { code: "ta-IN", greeting: "வணக்கம், நான் ஷெல்லி. சொல்லுங்கள்.", prefix: "ஷெல்லி பேசுகிறேன்.", fallback: "Score, sales area, video CTR, news signals கேளுங்கள், அல்லது tab க்கு போக சொல்லுங்கள்." },
  Marathi: { code: "mr-IN", greeting: "नमस्कार, मी शेली आहे. बोला.", prefix: "शेली बोलते आहे.", fallback: "Score, sales area, video CTR, news signals विचारा, किंवा tab वर घेऊन जा असे सांगा." },
  Kannada: { code: "kn-IN", greeting: "ನಮಸ್ಕಾರ, ನಾನು ಶೆಲ್ಲಿ. ಹೇಳಿ.", prefix: "ಶೆಲ್ಲಿ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ.", fallback: "Score, sales area, video CTR, news signals ಕೇಳಿ, ಅಥವಾ tab ಗೆ ತೆಗೆದುಕೊಂಡು ಹೋಗು ಎಂದು ಹೇಳಿ." },
  Malayalam: { code: "ml-IN", greeting: "നമസ്കാരം, ഞാൻ ഷെല്ലി. പറയൂ.", prefix: "ഷെല്ലിയാണ് സംസാരിക്കുന്നത്.", fallback: "Score, sales area, video CTR, news signals ചോദിക്കാം, അല്ലെങ്കിൽ tab തുറക്കാൻ പറയാം." },
  Odia: { code: "or-IN", greeting: "ନମସ୍କାର, ମୁଁ ଶେଲି। କୁହନ୍ତୁ।", prefix: "ଶେଲି କହୁଛି।", fallback: "Score, sales area, video CTR, news signals ପଚାରନ୍ତୁ, କିମ୍ବା tab କୁ ନେବାକୁ କୁହନ୍ତୁ।" },
  Punjabi: { code: "pa-IN", greeting: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਸ਼ੈਲੀ ਹਾਂ। ਦੱਸੋ।", prefix: "ਸ਼ੈਲੀ ਬੋਲ ਰਹੀ ਹੈ।", fallback: "Score, sales area, video CTR, news signals ਪੁੱਛੋ, ਜਾਂ tab ਤੇ ਲੈ ਜਾਣ ਲਈ ਕਹੋ।" },
  Haryanvi: { code: "hi-IN", greeting: "राम राम, मैं शेली सूँ। बोलो।", prefix: "शेली बोल री सूँ।", fallback: "Score, sales area, video CTR, news signals पूछो, या tab पे ले चल कहो।" }
};

const SHELLY_WAKE_RE = /\b(shelly|shelli|shelley|शेली|शैली|షెల్లీ|ஷெல்லி|ಶೆಲ್ಲಿ|ഷെല്ലി|ଶେଲି|ਸ਼ੈਲੀ)\b/i;

function currentAssistantLanguage(command = "") {
  const selected = $("languageSelect")?.value || "English";
  const text = command.toLowerCase();
  if (/[\u0900-\u097F]/.test(command)) return selected === "Marathi" || selected === "Haryanvi" ? selected : "Hindi";
  if (/[\u0C00-\u0C7F]/.test(command)) return "Telugu";
  if (/[\u0B80-\u0BFF]/.test(command)) return "Tamil";
  if (/[\u0C80-\u0CFF]/.test(command)) return "Kannada";
  if (/[\u0D00-\u0D7F]/.test(command)) return "Malayalam";
  if (/[\u0B00-\u0B7F]/.test(command)) return "Odia";
  if (/[\u0A00-\u0A7F]/.test(command)) return "Punjabi";
  if (text.includes("namaste") || text.includes("hindi")) return "Hindi";
  return selected in SHELLY_LANG ? selected : "English";
}

function detectShellyMood(command) {
  const text = command.toLowerCase();
  if (/(angry|irritated|annoyed|frustrated|bad|worried|confused|stress|tension|problem|issue|hate)/.test(text)) return "concerned";
  if (/(great|good|nice|love|happy|awesome|excellent|perfect)/.test(text)) return "positive";
  if (/(urgent|fast|quick|now|jaldi|abhi)/.test(text)) return "urgent";
  return "neutral";
}

function moodOpener(mood, language) {
  if (language !== "English") return SHELLY_LANG[language]?.prefix || SHELLY_LANG.English.prefix;
  if (mood === "concerned") return "I hear you. Let me keep this direct.";
  if (mood === "urgent") return "Got it, quick answer.";
  if (mood === "positive") return "Nice. Here is the useful bit.";
  return "Shelly here.";
}

function stripWakeName(command) {
  return command.replace(SHELLY_WAKE_RE, "").trim();
}

function tabFromVoice(command) {
  const text = command.toLowerCase();
  const tabs = [
    ["market", "market"],
    ["opportunity engine", "scorer"],
    ["opportunity", "scorer"],
    ["campaign", "campaign"],
    ["video", "video"],
    ["video campaigns", "video"],
    ["geo", "geo"],
    ["sales", "geo"],
    ["planner", "planner"],
    ["unit economics", "unit"],
    ["economics", "unit"],
    ["report", "report"],
    ["tracker", "experiments"],
    ["sources", "sources"],
    ["signals", "signals"],
    ["news", "signals"]
  ];
  const match = tabs.find(([phrase]) => text.includes(phrase));
  return match?.[1] || null;
}

function answerSpecificQuestion(command, language) {
  const text = command.toLowerCase();
  const city = cityFor("citySelect");
  const selectedLanguage = $("languageSelect")?.value || "English";
  const category = $("categorySelect")?.value || "Grocery";
  const platform = getPlatforms().find(item => item.id === ($("scorerPlatformSelect")?.value || "blinkit")) || selectedPlatform();
  const score = calculateScore(city, selectedLanguage, category);
  const geoRows = geoAreaRows({ city, range: "daily", metric: "sales", channel: "All channels" }).sort((a, b) => b.sales - a.sales);
  const topArea = geoRows[0];
  const videoRows = videoSampleRows({ city, language: selectedLanguage, category, platform, format: "Instagram Reel", manager: "Area manager" })
    .map(row => ({ ...row, ctr: row.clicked / row.reached }))
    .sort((a, b) => b.ctr - a.ctr);
  const topVideo = videoRows[0];
  const ctx = {
    platform: platform.name,
    city: city.city,
    language: selectedLanguage,
    category,
    score: score.score,
    confidence: score.confidence,
    area: topArea.area,
    sales: formatNumber(topArea.sales),
    action: topArea.action,
    audience: topVideo.segment,
    ctr: (topVideo.ctr * 100).toFixed(1)
  };
  const say = (kind) => localizedShellyAnswer(kind, language, ctx);

  if (text.includes("score") || text.includes("opportunity") || text.includes("स्कोर") || text.includes("स्कोअर")) {
    return say("score");
  }
  if (text.includes("sales") || text.includes("area") || text.includes("where") || text.includes("सेल") || text.includes("एरिया")) {
    return say("sales");
  }
  if (text.includes("video") || text.includes("ctr") || text.includes("reel") || text.includes("youtube") || text.includes("instagram")) {
    return say("video");
  }
  if (text.includes("news") || text.includes("signal") || text.includes("market update") || text.includes("खबर")) {
    const signal = marketSignals?.signals?.[0];
    if (signal) return language === "English" ? `Latest saved signal: ${signal.signal_summary}.` : `${SHELLY_LANG[language]?.prefix || ""} Latest saved signal: ${signal.signal_summary}.`;
    return say("news");
  }
  if (text.includes("what should") || text.includes("next") || text.includes("recommend") || text.includes("क्या कर") || text.includes("पुढे")) {
    return score.score >= 70 ? say("nextScale") : say("nextValidate");
  }
  if (language !== "English") return SHELLY_LANG[language]?.fallback || SHELLY_LANG.English.fallback;
  return SHELLY_LANG.English.fallback;
}

function localizedShellyAnswer(kind, language, c) {
  const en = {
    score: `${c.platform} in ${c.city}, ${c.language}, ${c.category}: opportunity score is ${c.score} out of 100, confidence ${c.confidence}.`,
    sales: `Watch ${c.area}. Estimated daily sales are ${c.sales} rupees. Action: ${c.action}.`,
    video: `Best video audience is ${c.audience}, with estimated CTR ${c.ctr} percent. Test more native short videos there.`,
    news: "Real-time news is not connected yet. I can only read saved dashboard signals for now.",
    nextScale: `Next step: run a small measured pilot in ${c.area}, using ${c.language} copy and video retargeting for ${c.audience}.`,
    nextValidate: `Next step: do not scale yet. Validate the ${c.language} ${c.category} wedge with a small pilot and upload real results.`
  };
  const hi = {
    score: `${c.city} में ${c.platform}, ${c.language}, ${c.category} का opportunity score ${c.score} out of 100 है. Confidence ${c.confidence}.`,
    sales: `${c.area} पर ध्यान दें. Estimated daily sales ${c.sales} rupees हैं. Action: ${c.action}.`,
    video: `Video के लिए सबसे अच्छा audience ${c.audience} है. Estimated CTR ${c.ctr} percent. वहाँ native short videos test करें.`,
    news: "Real-time news अभी connected नहीं है. मैं अभी saved dashboard signals ही पढ़ सकती हूँ.",
    nextScale: `Next step: ${c.area} में छोटा measured pilot चलाइए, ${c.language} copy और ${c.audience} retargeting के साथ.`,
    nextValidate: `Next step: अभी scale मत कीजिए. पहले ${c.language} ${c.category} wedge को छोटे pilot से validate करें.`
  };
  const te = {
    score: `${c.city} లో ${c.platform}, ${c.language}, ${c.category} opportunity score ${c.score} out of 100. Confidence ${c.confidence}.`,
    sales: `${c.area} ని watch చేయండి. Estimated daily sales ${c.sales} rupees. Action: ${c.action}.`,
    video: `Video కోసం best audience ${c.audience}. Estimated CTR ${c.ctr} percent. అక్కడ native short videos test చేయండి.`,
    news: "Real-time news ఇంకా connected లేదు. ఇప్పటికి saved dashboard signals మాత్రమే చదవగలను.",
    nextScale: `Next step: ${c.area} లో small measured pilot run చేయండి, ${c.language} copy మరియు ${c.audience} retargeting తో.`,
    nextValidate: `Next step: ఇప్పుడే scale చేయకండి. ముందుగా ${c.language} ${c.category} wedge ని small pilot తో validate చేయండి.`
  };
  const mr = {
    score: `${c.city} मध्ये ${c.platform}, ${c.language}, ${c.category} चा opportunity score ${c.score} out of 100 आहे. Confidence ${c.confidence}.`,
    sales: `${c.area} वर लक्ष ठेवा. Estimated daily sales ${c.sales} rupees आहेत. Action: ${c.action}.`,
    video: `Video साठी best audience ${c.audience} आहे. Estimated CTR ${c.ctr} percent. तिथे native short videos test करा.`,
    news: "Real-time news अजून connected नाही. आत्ता मी saved dashboard signals वाचू शकते.",
    nextScale: `Next step: ${c.area} मध्ये छोटा measured pilot चालवा, ${c.language} copy आणि ${c.audience} retargeting सोबत.`,
    nextValidate: `Next step: अजून scale करू नका. आधी ${c.language} ${c.category} wedge छोट्या pilot ने validate करा.`
  };
  if (language === "Hindi" || language === "Haryanvi") return hi[kind] || en[kind];
  if (language === "Telugu") return te[kind] || en[kind];
  if (language === "Marathi") return mr[kind] || en[kind];
  return en[kind];
}

function getVoiceBriefText(command = "brief") {
  const city = cityFor("citySelect");
  const language = $("languageSelect")?.value || "English";
  const category = $("categorySelect")?.value || "Grocery";
  const platform = getPlatforms().find(item => item.id === ($("scorerPlatformSelect")?.value || "blinkit")) || selectedPlatform();
  const score = calculateScore(city, language, category);
  const geoCtx = { city, range: "daily", metric: "sales", channel: "All channels" };
  const geoRows = geoAreaRows(geoCtx).sort((a, b) => b.sales - a.sales);
  const topArea = geoRows[0];
  const videoRows = videoSampleRows({ city, language, category, platform, format: "Instagram Reel", manager: "Area manager" })
    .map(row => ({ ...row, ctr: row.clicked / row.reached }))
    .sort((a, b) => b.ctr - a.ctr);
  const topVideoAudience = videoRows[0];
  const signal = marketSignals?.signals?.find(s => {
    const group = getSignalBrandGroup(s).toLowerCase();
    return platform.name.toLowerCase().includes(group) || group.includes(platform.name.split(" ")[0].toLowerCase());
  });

  const newsLine = signal
    ? `Latest saved market signal: ${signal.signal_summary}.`
    : "Real-time news API is not connected yet, so I am using saved dashboard signals and local planning data.";

  const action = score.score >= 70
    ? `Proceed with a measured pilot in ${topArea.area}.`
    : `Do not scale yet. Validate the ${language} ${category} wedge with a small pilot first.`;

  const videoAction = topVideoAudience
    ? `For video, focus on ${topVideoAudience.segment}, because it has the strongest estimated click intent.`
    : "For video, run one hook test before increasing spend.";

  const text = [
    `Here is your ${command.includes("market") ? "market update" : "dashboard brief"}.`,
    `${platform.name}, ${city.city}, ${language}, ${category}. Opportunity score is ${score.score} out of 100, confidence ${score.confidence}.`,
    newsLine,
    `Sales area to watch: ${topArea.area}, estimated daily sales ${formatNumber(topArea.sales)} rupees. Recommended action: ${topArea.action}.`,
    videoAction,
    `My recommendation: ${action} Keep tracking clicks, replies, orders, repeat rate, and local stock issues before claiming performance.`
  ].join(" ");

  return text;
}

function pickShellyVoice(langCode) {
  if (!("speechSynthesis" in window)) return null;
  shellyVoices = shellyVoices.length ? shellyVoices : window.speechSynthesis.getVoices();
  const exact = shellyVoices.find(v => v.lang === langCode && /natural|neural|online|female|zira|heera|kalpana/i.test(v.name));
  if (exact) return exact;
  return shellyVoices.find(v => v.lang === langCode) || shellyVoices.find(v => v.lang?.startsWith(langCode.split("-")[0])) || null;
}

function stopShellyListening() {
  if (voiceRecognition && voiceListening) {
    try { voiceRecognition.stop(); } catch { /* browser may already be stopping */ }
  }
  voiceListening = false;
  $("voiceCommandBtn")?.classList.remove("listening");
}

function speakVoiceBrief(text, language = "English", options = {}) {
  if (!("speechSynthesis" in window)) {
    $("voiceAssistantStatus").textContent = "Speech output is not supported in this browser.";
    return;
  }
  stopShellyListening();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const lang = SHELLY_LANG[language] || SHELLY_LANG.English;
  utterance.lang = lang.code;
  utterance.voice = pickShellyVoice(lang.code);
  utterance.rate = 0.96;
  utterance.pitch = 1.04;
  utterance.volume = 1;
  utterance.onstart = () => {
    shellySpeaking = true;
    $("voiceAssistantStatus").textContent = "Shelly is speaking...";
  };
  utterance.onend = () => {
    shellySpeaking = false;
    if (options.stopAfter || shellyStopAfterAnswer) {
      shellyStopAfterAnswer = false;
      shellyStandby = false;
      $("voiceCommandBtn").lastChild.nodeValue = " Shelly Ready";
      $("voiceAssistantStatus").textContent = "Shelly is quiet now.";
      return;
    }
    $("voiceAssistantStatus").textContent = shellyStandby ? "Shelly is listening. Ask naturally, or say Shelly stop please." : "Done.";
    restartShellyStandby();
  };
  window.speechSynthesis.speak(utterance);
}

function handleVoiceCommand(command) {
  const normalized = command.toLowerCase();
  $("voiceAssistantStatus").textContent = `Heard: "${command}"`;
  const hasWake = SHELLY_WAKE_RE.test(command);
  if (!shellyStandby && !hasWake) {
    restartShellyStandby();
    return;
  }

  const language = currentAssistantLanguage(command);
  const mood = detectShellyMood(command);
  const intent = stripWakeName(command);
  const wantsStop = /(stop|sleep|quiet|pause|shut up|band|ruko|ruk ja|बस|रुको|बंद|ఆపు|நிறுத்து|थांब)/i.test(intent);
  const saysPlease = /\bplease\b/i.test(intent) || /कृपया|प्लीज/i.test(intent);
  if (wantsStop) {
    shellyStandby = false;
    speakVoiceBrief(`${moodOpener(mood, language)} Okay, I will stay quiet.`, language, { stopAfter: true });
    return;
  }
  shellyStopAfterAnswer = saysPlease;
  const tab = tabFromVoice(intent);
  if (tab && /(take|go|open|show|switch|ले|जाओ|खोल|open)/i.test(intent)) {
    goToTab(tab);
    const tabLabel = document.querySelector(`.tab[data-tab="${tab}"]`)?.textContent || tab;
    speakVoiceBrief(`${moodOpener(mood, language)} Taking you to ${tabLabel}.`, language);
    return;
  }

  const answer = answerSpecificQuestion(intent || command, language);
  speakVoiceBrief(`${moodOpener(mood, language)} ${answer}`, language);
}

function restartShellyStandby() {
  if (!shellyStandby || !voiceRecognition || shellySpeaking) return;
  if (voiceListening) return;
  try {
    const language = currentAssistantLanguage();
    voiceRecognition.lang = SHELLY_LANG[language]?.code || "en-IN";
    voiceRecognition.start();
    voiceListening = true;
    $("voiceCommandBtn")?.classList.add("listening");
    $("voiceAssistantStatus").textContent = "Shelly is listening. Ask naturally, or say Shelly stop please.";
  } catch {
    // Browser may still be closing the previous recognition session.
    setTimeout(restartShellyStandby, 500);
  }
}

function setupVoiceAssistant() {
  const btn = $("voiceCommandBtn");
  const panel = $("voiceAssistantPanel");
  if (!btn || !panel) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = "en-IN";
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = false;
    voiceRecognition.onresult = event => {
      const result = event.results?.[event.results.length - 1];
      const transcript = result?.[0]?.transcript || "";
      voiceListening = false;
      btn.classList.remove("listening");
      if (transcript) handleVoiceCommand(transcript);
    };
    voiceRecognition.onerror = () => {
      voiceListening = false;
      btn.classList.remove("listening");
      shellyStandby = false;
      btn.lastChild.nodeValue = " Shelly Ready";
      $("voiceAssistantStatus").textContent = "Browser blocked or missed the mic. Click Shelly Ready once, then she can stay on standby.";
    };
    voiceRecognition.onend = () => {
      voiceListening = false;
      btn.classList.remove("listening");
      restartShellyStandby();
    };
  }

  function activateShelly({ auto = false } = {}) {
    panel.classList.remove("hidden");
    if (!voiceRecognition) {
      $("voiceAssistantStatus").textContent = "Voice input is not supported here. Use Ask Shelly brief for spoken output.";
      return;
    }
    if (shellyStandby) {
      shellyStandby = false;
      stopShellyListening();
      btn.lastChild.nodeValue = " Shelly Ready";
      $("voiceAssistantStatus").textContent = "Shelly is off.";
      return;
    }
    shellyStandby = true;
    voiceListening = true;
    btn.classList.add("listening");
    btn.lastChild.nodeValue = " Shelly On";
    const language = currentAssistantLanguage();
    voiceRecognition.lang = SHELLY_LANG[language]?.code || "en-IN";
    $("voiceAssistantStatus").textContent = "Shelly is listening. Ask naturally, or say Shelly stop please.";
    if (auto) {
      try {
        voiceRecognition.start();
      } catch {
        shellyStandby = false;
        voiceListening = false;
        btn.classList.remove("listening");
        btn.lastChild.nodeValue = " Shelly Ready";
        $("voiceAssistantStatus").textContent = "Shelly is ready, but Chrome needs one click to unlock the microphone.";
      }
    } else {
      speakVoiceBrief(SHELLY_LANG[language]?.greeting || SHELLY_LANG.English.greeting, language);
    }
  }

  btn.addEventListener("click", () => activateShelly());

  $("voiceReadBrief")?.addEventListener("click", () => {
    const language = currentAssistantLanguage();
    speakVoiceBrief(getVoiceBriefText("today's brief"), language);
  });
  $("voiceStopBrief")?.addEventListener("click", () => {
    shellyStandby = false;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopShellyListening();
    btn.lastChild.nodeValue = " Shelly Ready";
    $("voiceAssistantStatus").textContent = "Stopped.";
  });

  if ("speechSynthesis" in window) {
    shellyVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => { shellyVoices = window.speechSynthesis.getVoices(); };
  }

  setTimeout(() => activateShelly({ auto: true }), 900);
}

function selectedMulti(id) {
  return Array.from($(id).selectedOptions).map(option => option.value);
}

function renderExperimentPlanStatic() {
  const city = cityFor("plannerCitySelect");
  const language = $("plannerLanguageSelect").value;
  const category = $("plannerCategorySelect").value;
  const platform = getPlatforms().find(item => item.id === $("plannerPlatformSelect").value) || selectedPlatform();
  const objective = $("plannerObjectiveSelect").value;
  const channels = selectedMulti("plannerChannelSelect");
  const duration = $("plannerDurationSelect").value;
  const budget = $("plannerBudgetSelect").value;
  const offer = $("plannerOfferSelect").value;
  const timeline = duration.includes("14") ? "Days 1-2 setup; 3-7 launch; 8-12 optimize; 13-14 review." : "Day 1 setup; mid-window check; final CSV review.";
  const rows = [
    ["Experiment name", `${platform.name} ${city.city} ${language} ${category} pilot`],
    ["Hypothesis", `${language} creative for ${category} can improve ${objective.toLowerCase()} in serviceable ${city.city} pockets; requires pilot data.`],
    ["Campaign setup", `${duration}, ${budget}, ${offer}. Use UTM links and serviceability checks.`],
    ["Channels", channels.join(", ") || "No channel selected"],
    ["KPI focus", primaryKpi(objective)],
    ["Success threshold", "Manager-defined; requires pilot data."],
    ["Stop-loss rule", "Pause if CAC, serviceability, stock, or complaint risk breaches manager limit."],
    ["Risk notes", `${platform.risks?.[0] || "Requires independent source"} Native copy requires review.`],
    ["Timeline", timeline]
  ];
  $("experimentPlanOutput").innerHTML = rows.map(([label, value]) => `<div class="planner-row"><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>`).join("");
}

async function generateBackendExperimentPlan() {
  const city = cityFor("plannerCitySelect");
  const language = $("plannerLanguageSelect").value;
  const category = $("plannerCategorySelect").value;
  const platform = getPlatforms().find(item => item.id === $("plannerPlatformSelect").value) || selectedPlatform();
  const payload = {
    platform: platformPayloadValue(platform),
    city: city.city,
    language,
    category,
    objective: $("plannerObjectiveSelect").value,
    budget: $("plannerBudgetSelect").value,
    duration: $("plannerDurationSelect").value,
    offer: $("plannerOfferSelect").value,
    channels: selectedMulti("plannerChannelSelect")
  };
  $("experimentPlanOutput").innerHTML = `<div class="planner-row"><span>Status</span><p>Generating backend experiment plan...</p></div>`;
  try {
    const response = await postBackend("/planner", payload);
    const rows = [
      ["Hypothesis", response.hypothesis],
      ["Test group", response.test_group],
      ["Control group", response.control_group],
      ["KPIs", (response.kpis || []).map(kpi => `${kpi.role}: ${kpi.name} ${kpi.target}`).join(" | ")],
      ["Timeline", response.timeline],
      ["Budget split", Object.entries(response.budget_split || {}).map(([key, value]) => `${key}: ${value}%`).join(", ")],
      ["Success threshold", response.success_threshold],
      ["Failure threshold", response.failure_threshold]
    ];
    $("experimentPlanOutput").innerHTML = rows.map(([label, value]) => `<div class="planner-row"><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>`).join("");
  } catch (error) {
    console.warn("Backend planner failed; using static experiment plan.", error);
    renderExperimentPlanStatic();
  }
}

function renderExperimentPlan() {
  renderExperimentPlanStatic();
}

function primaryKpi(objective) {
  if (objective.includes("Awareness")) return "CTR and reach";
  if (objective.includes("Repeat")) return "Repeat order rate";
  if (objective.includes("WhatsApp")) return "WhatsApp reply rate and CTR";
  if (objective.includes("Society")) return "Society penetration and first orders";
  return "CVR, CAC, first orders";
}

function renderUnitEconomicsStatic() {
  const aov = Number($("unitAovInput").value || 0);
  const margin = Number($("unitMarginInput").value || 0) / 100;
  const repeat = Number($("unitRepeatInput").value || 0);
  const cac = Number($("unitCacInput").value || 0);
  const lifetime = Number($("unitLifetimeInput").value || 0);
  const monthlyProfit = aov * margin * repeat;
  const ltv = monthlyProfit * lifetime;
  const ratio = cac ? ltv / cac : 0;
  const payback = monthlyProfit ? cac / monthlyProfit : 0;
  const verdict = ratio >= 3 ? "Promising assumption" : ratio >= 1 ? "Watch CAC carefully" : "Unit economics risk";
  const cards = [
    ["LTV", `INR ${formatNumber(Math.round(ltv))}`, "AOV x margin x repeat x lifetime"],
    ["LTV:CAC", `${ratio.toFixed(1)}x`, "User-adjustable assumption"],
    ["CAC payback", `${payback.toFixed(1)} months`, "CAC / monthly gross profit"],
    ["Monthly gross profit/user", `INR ${formatNumber(Math.round(monthlyProfit))}`, "AOV x margin x repeat"],
    ["Verdict", verdict, "Not a market fact"]
  ];
  $("unitEconomicsOutput").innerHTML = cards.map(([label, value, caption]) => `<article class="kpi-card"><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-value">${escapeHtml(value)}</div><div class="kpi-caption">${escapeHtml(caption)}</div></article>`).join("");
}

let unitEconomicsRequestId = 0;

async function renderUnitEconomics() {
  const requestId = ++unitEconomicsRequestId;
  const payload = {
    aov: Number($("unitAovInput").value || 0),
    margin_pct: Number($("unitMarginInput").value || 0),
    repeat_orders_month: Number($("unitRepeatInput").value || 0),
    cac: Number($("unitCacInput").value || 0),
    lifetime_months: Number($("unitLifetimeInput").value || 0)
  };
  try {
    const response = await postBackend("/uniteconomics", payload);
    if (requestId !== unitEconomicsRequestId) return;
    const cards = [
      ["LTV", `INR ${formatNumber(Math.round(response.ltv))}`, "Backend calculation"],
      ["LTV:CAC", `${Number(response.ltv_cac_ratio).toFixed(2)}x`, "LTV / CAC"],
      ["CAC payback", `${Number(response.payback_months).toFixed(2)} months`, "CAC / monthly contribution"],
      ["Monthly contribution/user", `INR ${formatNumber(Math.round(response.contribution_margin))}`, "AOV x margin x repeat"],
      ["True ROAS", `${Number(response.true_roas).toFixed(2)}x`, "LTV / CAC"],
      ["Verdict", response.verdict, (response.warning_flags || []).join(", ") || "No warning flags"]
    ];
    $("unitEconomicsOutput").innerHTML = cards.map(([label, value, caption]) => `<article class="kpi-card"><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-value">${escapeHtml(value)}</div><div class="kpi-caption">${escapeHtml(caption)}</div></article>`).join("");
  } catch (error) {
    if (requestId !== unitEconomicsRequestId) return;
    console.warn("Backend unit economics failed; using static calculation.", error);
    renderUnitEconomicsStatic();
  }
}

function reportInputs() {
  return {
    platform: getPlatforms().find(item => item.id === $("reportPlatformSelect").value) || selectedPlatform(),
    city: cityFor("reportCitySelect"),
    language: $("reportLanguageSelect").value,
    category: $("reportCategorySelect").value,
    objective: $("reportObjectiveSelect").value,
    offer: $("offerInput").value,
    tone: $("toneSelect").value,
    channels: selectedMulti("channelMixSelect"),
    notes: $("reportNotesInput").value || "No additional notes."
  };
}

function renderReportStatic() {
  const data = reportInputs();
  const score = calculateScore(data.city, data.language, data.category).score;
  const pilotNote = pilotCampaignUploaded ? "Pilot CSV uploaded; review tracker before claiming outcomes." : "Pilot data not uploaded. Do not claim CAC reduction, conversion lift, or revenue impact.";
  lastReportHtml = `
    <header class="report-section"><p class="eyebrow">Executive GTM Report</p><h2>Bharat Hyperlocal GTM Machine</h2><p>${escapeHtml(data.platform.name)} - ${escapeHtml(data.city.city)} - ${escapeHtml(data.language)} - ${escapeHtml(data.category)}</p><p><strong>${escapeHtml(pilotNote)}</strong></p></header>
    ${reportSection("Executive Summary", [`Test ${data.category} in ${data.city.city} for ${data.objective}.`, `Use ${data.platform.name} as the platform lens: ${data.platform.gtmImplication}`, `Opportunity score ${score}/100 is a planning assumption.`, `Channel mix: ${data.channels.join(", ") || "not selected"}.`])}
    ${reportTableSection("Market Audit", [["Public market context", "CareEdge Advisory, Swiggy FY25, Economic Times, and Global Newswire sources are listed in the audit trail."], ["Platform context", data.platform.currentRole], ["Missing data", data.platform.publicMetrics.includes("needs source") ? "Requires independent source" : "All displayed metrics have public source"]])}
    ${reportTableSection("ICP Hypothesis", [["Primary audience", "Urban quick-commerce users in serviceable pin codes"], ["Purchase trigger", `Urgent or repeat ${data.category.toLowerCase()} need`], ["Trust barrier", "Delivery promise, stock, and offer clarity"], ["Message angle", `${data.tone} local serviceability-led copy`]])}
    ${reportTableSection("City-Language-Category Opportunity", [["City", data.city.city], ["Language", data.language], ["Category", data.category], ["Score", `${score}/100`], ["Risks", categoryProfile(data.category).risk]])}
    ${reportSection("Campaign Strategy", [`Core idea: ${data.offer}.`, `Creative angle: ${data.tone} copy with city and category relevance.`, "CTA: deep link to the app category page with UTM tracking."])}
    ${calendarTable()}
    ${reportSection("WhatsApp Funnel", ["Trigger: local need.", "Opening: short category-led message.", `Offer: ${data.offer}.`, "CTA: tracked app link.", "Follow-up: consent-aware reminder."])}
    ${reportTableSection("Push Notification Plan", [["Launch", "Announce local category availability", "CTR"], ["Urgency", "Reinforce purchase occasion", "App opens"], ["Trust", "Clarify serviceability", "CVR"], ["Reminder", "Repeat controlled offer", "Orders"], ["Repeat", "Replenishment prompt", "Repeat order rate"]])}
    ${reportSection("Creator / Society Ambassador Brief", ["Creator type: local society or neighborhood voice.", "Format: short demo, story, or group message.", "Do: show real use case and serviceability boundary.", "Do not: claim performance results or guaranteed delivery outside serviceable pin codes.", "Tracking: use UTM/deep link."])}
    ${reportSection("Execution SOP", ["Confirm city, language, category, offer, and serviceable pin codes.", "Create English control and local variant.", "Add UTM links before posting.", "Log post time, link, channel, and notes.", "Escalate stock, complaint, or translation issues immediately."])}
    ${reportTableSection("KPI Tracking Table", [["CTR", "Clicks / impressions", "Awaiting pilot data"], ["CAC", "Spend / paying customers", "Awaiting pilot data"], ["CVR", "Orders / clicks", "Awaiting pilot data"], ["Add-to-cart rate", "ATC / visits", "Awaiting pilot data"], ["First-order conversion", "First orders / eligible users", "Awaiting pilot data"], ["Repeat order rate", "Repeat users / customers", "Awaiting pilot data"], ["WhatsApp reply rate", "Replies / delivered", "Awaiting pilot data"], ["Orders per pin code", "Orders grouped locally", "Awaiting pilot data"]])}
    ${reportSection("Risks and Guardrails", ["Translation risk", "Over-discounting risk", "Spam risk", "Creator quality risk", "Weak attribution risk", "Operational capacity risk", "Unit economics risk"])}
    ${reportSection("Source and Assumption Notes", ["Public data used: see Sources tab.", "Missing data: values shown as requires independent source.", "Assumptions: city-language score and unit economics are planning assumptions.", "Pilot data required for CAC, CTR, CVR, repeat rate, revenue, and lift claims.", `Manager notes: ${data.notes}`])}
  `;
  lastReportMarkdown = $("briefOutput").innerText || "";
  $("briefOutput").innerHTML = lastReportHtml;
  lastReportMarkdown = $("briefOutput").innerText;
  reportExportReady = true;
  renderCampaignStatus();
}

function markdownToReportHtml(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  return lines.map(line => {
    if (line.startsWith("### ")) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
    if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (/^\d+\.\s+/.test(line)) return `<p><strong>${escapeHtml(line)}</strong></p>`;
    if (line.startsWith("- ")) return `<p>• ${escapeHtml(line.slice(2))}</p>`;
    if (!line.trim()) return "";
    return `<p>${escapeHtml(line)}</p>`;
  }).join("");
}

async function generateBackendReport() {
  const data = reportInputs();
  const payload = {
    platform: platformPayloadValue(data.platform),
    city: data.city.city,
    language: data.language,
    category: data.category,
    objective: data.objective,
    offer: data.offer,
    tone: data.tone,
    channels: data.channels,
    notes: data.notes
  };
  $("briefOutput").innerHTML = `<p class="note">Generating backend executive report...</p>`;
  try {
    const response = await postBackend("/report", payload);
    lastReportMarkdown = response.markdown || "";
    lastReportHtml = `<section class="report-section">${markdownToReportHtml(lastReportMarkdown)}</section>`;
    $("briefOutput").innerHTML = lastReportHtml;
    reportExportReady = true;
    renderCampaignStatus();
  } catch (error) {
    console.warn("Backend report failed; using static report.", error);
    renderReportStatic();
  }
}

function renderReport() {
  renderReportStatic();
}

function reportSection(title, items) {
  return `<section class="report-section"><h3>${escapeHtml(title)}</h3><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`;
}

function reportTableSection(title, rows) {
  return `<section class="report-section"><h3>${escapeHtml(title)}</h3><table class="report-table"><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
}

function calendarTable() {
  const rows = Array.from({ length: 14 }, (_, i) => [`Day ${i + 1}`, i < 2 ? "Setup" : i < 7 ? "Launch" : i < 12 ? "Optimize" : "Review", "Tracked link", i < 7 ? "CTR / app opens" : "orders / repeat intent"]);
  return `<section class="report-section"><h3>14-Day Content Calendar</h3><table class="report-table"><thead><tr><th>Day</th><th>Content idea</th><th>CTA</th><th>KPI</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
}

function clearReport() {
  $("briefOutput").innerHTML = "";
  lastReportHtml = "";
  lastReportMarkdown = "";
  reportExportReady = false;
  renderCampaignStatus();
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(item => item.trim());
  return lines.slice(1).filter(Boolean).map(line => {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, index) => { row[header] = values[index]?.trim() || ""; });
    return row;
  });
}

function numberFrom(row, key) {
  return Number(row[key] || 0);
}

function renderCampaignData(rows) {
  if (!rows.length) return;
  pilotCampaignUploaded = true;
  $("campaignEmpty")?.classList.add("hidden");
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
  const ctr = totals.impressions ? totals.clicks / totals.impressions * 100 : 0;
  const cvr = totals.clicks ? totals.orders / totals.clicks * 100 : 0;
  const cac = totals.orders ? totals.spend / totals.orders : 0;
  const repeat = totals.orders ? totals.repeatOrders / totals.orders * 100 : 0;
  const cards = [["Spend", `INR ${formatNumber(Math.round(totals.spend))}`], ["Orders", formatNumber(totals.orders)], ["CTR", `${ctr.toFixed(2)}%`], ["CAC", totals.orders ? `INR ${Math.round(cac)}` : "N/A"], ["CVR", `${cvr.toFixed(2)}%`], ["Repeat rate", `${repeat.toFixed(1)}%`], ["Revenue", `INR ${formatNumber(Math.round(totals.revenue))}`], ["Rows", rows.length]];
  $("campaignKpis").innerHTML = cards.map(([label, value]) => `<article class="kpi-card"><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-value">${escapeHtml(value)}</div><div class="kpi-caption">Imported pilot data</div></article>`).join("");
  drawBarChart("campaignChart", rows.map(row => ({ period: row.experiment_id, value: numberFrom(row, "orders") })), { unit: "Orders" });
  $("campaignTable").innerHTML = `<table><thead><tr><th>Experiment</th><th>City</th><th>Language</th><th>Category</th><th>Spend</th><th>Orders</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.experiment_id)}</td><td>${escapeHtml(row.city)}</td><td>${escapeHtml(row.language)}</td><td>${escapeHtml(row.category)}</td><td>INR ${formatNumber(numberFrom(row, "spend_inr"))}</td><td>${formatNumber(numberFrom(row, "orders"))}</td></tr>`).join("")}</tbody></table>`;
  renderCampaignStatus();
}

function showTab(tabId) {
  goToTab(tabId);
}

function setupScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal-section").forEach(el => observer.observe(el));
}

function setupFloatingParticles() {
  const container = $("floatingParticles");
  if (!container) return;
  const count = 30;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = Math.random() * 100 + "%";
    particle.style.animationDuration = (8 + Math.random() * 16) + "s";
    particle.style.animationDelay = (Math.random() * 10) + "s";
    particle.style.width = (1 + Math.random() * 2) + "px";
    particle.style.height = particle.style.width;
    container.appendChild(particle);
  }
}

function setupScrollLinks() {
  document.querySelectorAll(".scroll-link").forEach(link => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.querySelector(link.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
}

function attachEvents() {
  $("enterWarRoom").addEventListener("click", showBrandMap);
  const enterBtnBottom = $("enterWarRoomBottom");
  if (enterBtnBottom) enterBtnBottom.addEventListener("click", showBrandMap);
  $("backToLanding").addEventListener("click", showLanding);
  $("backToBrandMap").addEventListener("click", showBrandMap);
  $("changePlatform").addEventListener("click", showBrandMap);
  const startBtn = $("startBenchmark");
  if (startBtn) startBtn.addEventListener("click", startBenchmark);
  $("brandTileGrid").addEventListener("click", event => {
    const tile = event.target.closest("[data-platform]");
    if (!tile) return;
    setSelectedBenchmark(tile.dataset.platform);
  });
  $("bmCompareAll")?.addEventListener("click", renderBenchmarkComparison);
  $("bmResetView")?.addEventListener("click", resetBenchmarkView);
  $("bmCloseCompare")?.addEventListener("click", () => $("bmComparePanel").classList.add("hidden"));
  document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => showTab(button.dataset.tab)));
  document.querySelectorAll(".jump-tab").forEach(button => button.addEventListener("click", () => goToTab(button.dataset.tab)));
  $("platformSelect").addEventListener("change", () => {
    setActivePlatform($("platformSelect").value);
  });
  $("platformButtons").addEventListener("click", event => {
    const button = event.target.closest("[data-platform]");
    if (!button) return;
    $("platformSelect").value = button.dataset.platform;
    $("platformSelect").dispatchEvent(new Event("change"));
  });
  $("benchmarkLensSelect").addEventListener("change", renderPlatformIntelligence);
  ["marketMetricSelect", "marketViewSelect"].forEach(id => $(id).addEventListener("change", renderMarketPulse));
  [["citySelect", "languageSelect"], ["plannerCitySelect", "plannerLanguageSelect"], ["reportCitySelect", "reportLanguageSelect"], ["videoCitySelect", "videoLanguageSelect"]].forEach(([cityId, langId]) => $(cityId).addEventListener("change", () => { updateLanguageOptions(cityId, langId); populateConsumerSignalControls(); populatePriceWatchControls(); renderScore(); renderOeSignals(); renderExperimentPlan(); renderReport(); renderCampaignAutopilot(); renderBenchmarkCockpit(); renderVideoCampaignStudio(); }));
  ["languageSelect", "categorySelect", "scorerPlatformSelect", "objectiveSelect"].forEach(id => $(id).addEventListener("change", () => { populateConsumerSignalControls(); renderScore(); renderOeSignals(); renderCampaignAutopilot(); renderBenchmarkCockpit(); renderVideoCampaignStudio(); }));
  $("channelSelect")?.addEventListener("change", () => { renderScore(); });
  $("oeGenerateBrief").addEventListener("click", generateBrief);
  $("oeCopyBrief").addEventListener("click", copyBrief);
  $("oeExportJson").addEventListener("click", exportJson);
  $("oeMarkValidation").addEventListener("click", markValidation);
  $("oeExplainToggle").addEventListener("click", () => { toggleExplain(); if (!$("oeExplainPanel").classList.contains("hidden")) renderExplainPanel(); });
  ["caObjective", "caChannel", "caOffer", "caTone"].forEach(id => { const el = $(id); if (el) el.addEventListener("change", renderCampaignAutopilot); });
  $("caGenerateDraft").addEventListener("click", generateCampaignDraft);
  $("caCopyDraft").addEventListener("click", copyCampaignDraft);
  $("caCopyVernacular")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("vernacularDraftOutput")?.innerText || "");
      $("caCopyVernacular").textContent = "Copied!";
      setTimeout(() => { $("caCopyVernacular").textContent = "Copy vernacular draft"; }, 2000);
    } catch(e) { console.warn("Clipboard write failed", e); }
  });
  $("caAddToBrief").addEventListener("click", caAddToBrief);
  $("caExportJson").addEventListener("click", exportCampaignJson);
  $("caViewColumns").addEventListener("click", () => { const panel = $("caColumnMapping"); if (panel) panel.classList.toggle("hidden"); });
  $("caResetCsv").addEventListener("click", resetCsvData);
  $("caCsvUpload").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => { caCsvData = parseCsv(evt.target.result); const headers = Object.keys(caCsvData[0] || {}); caColumnMapping = detectColumnMapping(headers); renderCAMeasurementTracker(); renderCampaignAutopilot(); };
    reader.readAsText(file);
  });
  $("caSaveNote").addEventListener("click", () => { localStorage.setItem("caLearningNote", $("caLearningNote").value); $("caSaveNote").textContent = "Saved!"; setTimeout(() => { $("caSaveNote").textContent = "Save learning note"; }, 2000); });
  $("caClearNote").addEventListener("click", () => { $("caLearningNote").value = ""; localStorage.removeItem("caLearningNote"); });
  $("caResetCampaign").addEventListener("click", resetCampaign);
  ["videoPlatformSelect", "videoLanguageSelect", "videoCategorySelect", "videoFormatSelect", "videoManagerSelect"].forEach(id => { const el = $(id); if (el) el.addEventListener("change", renderVideoCampaignStudio); });
  ["geoCitySelect", "geoRangeSelect", "geoMetricSelect", "geoChannelSelect"].forEach(id => { const el = $(id); if (el) el.addEventListener("change", renderGeoSalesCommandCenter); });
  ["plannerPlatformSelect", "plannerLanguageSelect", "plannerCategorySelect", "plannerObjectiveSelect", "plannerBudgetSelect", "plannerDurationSelect", "plannerOfferSelect", "plannerChannelSelect"].forEach(id => $(id).addEventListener("change", renderExperimentPlan));
  $("generateExperimentPlan").addEventListener("click", generateBackendExperimentPlan);
  ["unitAovInput", "unitMarginInput", "unitRepeatInput", "unitCacInput", "unitLifetimeInput"].forEach(id => $(id).addEventListener("input", renderUnitEconomics));
  ["reportPlatformSelect", "reportLanguageSelect", "reportCategorySelect", "reportObjectiveSelect", "offerInput", "toneSelect", "channelMixSelect", "reportNotesInput"].forEach(id => $(id).addEventListener("change", renderReport));
  $("reportNotesInput").addEventListener("input", renderReport);
  $("generateReport").addEventListener("click", generateBackendReport);
  $("clearReport").addEventListener("click", clearReport);
  $("copyBrief").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("briefOutput").innerText); $("copyBrief").textContent = "Copied!"; setTimeout(() => { $("copyBrief").textContent = "Copy"; }, 2000); } catch(e) { console.warn("Clipboard write failed", e); } });
  $("downloadHtmlReport").addEventListener("click", () => downloadText("bharat-hyperlocal-gtm-report.html", `<!doctype html><html><body>${lastReportHtml}</body></html>`, "text/html"));
  $("downloadReport").addEventListener("click", () => downloadText("bharat-hyperlocal-gtm-report.md", lastReportMarkdown, "text/markdown"));
  $("printReport").addEventListener("click", () => window.print());
  $("campaignUpload").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => renderCampaignData(parseCsv(event.target.result));
    reader.readAsText(file);
  });
  $("ragSaveEndpoint")?.addEventListener("click", () => {
    const value = ($("ragApiUrlInput")?.value || "").trim().replace(/\/+$/, "");
    if (value) localStorage.setItem("bharatRagApiUrl", value);
    renderRagLayer();
    renderOeSignals();
    renderCampaignStatus();
  });
  $("ragClearEndpoint")?.addEventListener("click", () => {
    localStorage.removeItem("bharatRagApiUrl");
    if ($("ragApiUrlInput")) $("ragApiUrlInput").value = "";
    renderRagLayer();
    renderOeSignals();
    renderCampaignStatus();
  });
  $("ragGenerateBrief")?.addEventListener("click", generateRagBrief);
  $("ragRunIngest")?.addEventListener("click", requestRagIngest);
  $("ragJobSelect")?.addEventListener("change", renderRagLayer);
  $("ragCitySelect")?.addEventListener("change", renderRagLayer);
  $("csClassify")?.addEventListener("click", classifyConsumerSignal);
  $("pwAddSku")?.addEventListener("click", addPriceWatchSku);
  window.addEventListener("resize", renderMarketPulse);
  document.querySelectorAll("#oeTimeline .oe-step").forEach(step => {
    step.addEventListener("click", () => navigateOeStep(Number(step.dataset.step)));
    step.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigateOeStep(Number(step.dataset.step)); } });
  });
  setupScrollAnimations();
  setupFloatingParticles();
  $("signalBrandFilter")?.addEventListener("change", () => { renderTopSignals(); renderSignalTimeline(); renderSignalBrandMap(); });
  $("signalTypeFilter")?.addEventListener("change", () => { renderTopSignals(); renderSignalTimeline(); renderSignalBrandMap(); });
  $("signalConfFilter")?.addEventListener("change", () => { renderTopSignals(); renderSignalTimeline(); renderSignalBrandMap(); });
  $("signalNeedsValidation")?.addEventListener("change", () => { renderTopSignals(); renderSignalTimeline(); renderSignalBrandMap(); });
  $("signalViewAudit")?.addEventListener("click", renderSourceAudit);
  $("signalExportJson")?.addEventListener("click", () => {
    if (!marketSignals) return;
    const blob = new Blob([JSON.stringify(marketSignals, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "market_signals_2025_2026.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  $("signalModalClose")?.addEventListener("click", () => $("signalDetailModal").classList.add("hidden"));
  $("signalDetailModal")?.addEventListener("click", (e) => { if (e.target === $("signalDetailModal")) $("signalDetailModal").classList.add("hidden"); });
  setupScrollLinks();
  if (geoRefreshTimer) clearInterval(geoRefreshTimer);
  geoRefreshTimer = setInterval(() => {
    if ($("geo")?.classList.contains("active-panel")) renderGeoSalesCommandCenter();
  }, 30000);

  // Pipeline event listeners
  $("pipelineRunAll")?.addEventListener("click", async () => {
    const btn = $("pipelineRunAll");
    btn.textContent = "Running all agents...";
    btn.disabled = true;
    setPipelineStatus("Triggering all agents on backend...", "info");
    const result = await triggerPipelineAgent("all");
    btn.textContent = "Run all agents now";
    btn.disabled = false;
    if (result) {
      const newEv = result.newEvidence ?? result.lastIngestionResult?.newEvidence ?? result.ingestion?.newEvidence ?? 0;
      const totalEv = result.totalRecords ?? result.lastIngestionResult?.totalRecords ?? result.ingestion?.totalRecords ?? 0;
      const deltas = result.deltasCount ?? result.lastScoreResult?.deltas?.length ?? result.score?.deltas?.length ?? 0;
      const briefs = result.briefsCount ?? result.lastBriefResult?.briefsGenerated ?? result.brief?.briefsGenerated ?? 0;
      const mode = result.lastIngestionResult?.mode || result.ingestion?.mode || "live";
      setPipelineStatus(`All agents complete (${mode} mode): ${newEv} new evidence / ${totalEv} total, ${deltas} score deltas, ${briefs} briefs.`, "success");
    } else {
      setPipelineStatus("Could not reach backend. Is it running on http://127.0.0.1:8787?", "error");
    }
    renderPipelineAgents();
    renderPipelineLog();
  });
  $("pipelineRefresh")?.addEventListener("click", () => {
    renderPipelineAgents();
    renderPipelineLog();
    setPipelineStatus("Status refreshed.", "info");
  });
  document.querySelectorAll(".pipeline-run-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const agent = btn.dataset.agent;
      const originalText = btn.textContent;
      btn.textContent = "Running...";
      btn.disabled = true;
      setPipelineStatus(`Triggering ${agent} agent...`, "info");
      const result = await triggerPipelineAgent(agent);
      btn.textContent = originalText;
      btn.disabled = false;
      if (result) {
        const newEv = result.newEvidence ?? result.totalRecords ?? 0;
        const deltas = result.deltas?.length ?? result.scoreCount ?? 0;
        const briefs = result.briefs?.length ?? result.briefsGenerated ?? 0;
        const summary = agent === "ingestion" ? `${newEv} new evidence / ${result.totalRecords || 0} total`
          : agent === "score" ? `${deltas} score deltas (top: ${result.highestDelta?.signalDelta || 0})`
          : agent === "brief" ? `${briefs} briefs generated`
          : "completed";
        setPipelineStatus(`${agent} agent: ${summary}.`, "success");
      } else {
        setPipelineStatus(`Could not reach backend for ${agent} agent. Is it running on http://127.0.0.1:8787?`, "error");
      }
      renderPipelineAgents();
      renderPipelineLog();
    });
  });

  // Observability event listeners
  $("obsRefresh")?.addEventListener("click", () => renderObservability());
  $("obsCopyMetrics")?.addEventListener("click", async () => {
    const m = await getObservabilityMetrics();
    if (m) {
      await navigator.clipboard.writeText(JSON.stringify(m, null, 2));
      const btn = $("obsCopyMetrics");
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = orig, 1500);
    }
  });
  $("obsOpenPrometheus")?.addEventListener("click", () => {
    const base = getRagApiUrl();
    if (base) window.open(`${base}/metrics`, "_blank");
  });
  $("obsOpenHistory")?.addEventListener("click", () => {
    const base = getRagApiUrl();
    if (base) window.open(`${base}/metrics/history?windowMs=86400000`, "_blank");
  });
}

function setPipelineStatus(message, tone = "info") {
  const el = $("pipelineStatus");
  if (!el) return;
  el.textContent = message;
  el.setAttribute("data-tone", tone);
  if (tone === "info" || tone === "success") {
    setTimeout(() => { if (el.textContent === message) el.setAttribute("data-tone", ""); }, 6000);
  }
}

// ===== PIPELINE / MULTI-AGENT =====

async function getPipelineStatus() {
  const base = getRagApiUrl();
  if (!base) return null;
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000);
    const r = await fetch(`${base}/pipeline`, { signal: c.signal }); clearTimeout(t);
    if (!r.ok) return null; return await r.json();
  } catch { return null; }
}

async function triggerPipelineAgent(agent) {
  const base = getRagApiUrl();
  if (!base) return null;
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 300000); // 5min for agent runs
    const r = await fetch(`${base}/pipeline/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent }), signal: c.signal });
    clearTimeout(t); if (!r.ok) return null; return await r.json();
  } catch { return null; }
}

async function getPipelineLog(limit = 50) {
  const base = getRagApiUrl();
  if (!base) return [];
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000);
    const r = await fetch(`${base}/pipeline/log?limit=${limit}`, { signal: c.signal }); clearTimeout(t);
    if (!r.ok) return []; return await r.json();
  } catch { return []; }
}

function renderPipelineTab() {
  renderPipelineAgents();
  renderPipelineLog();
}

function renderPipelineAgents() {
  const grid = $("pipelineAgentGrid");
  if (!grid) return;
  const statusEl = document.querySelector('.tab[data-tab="pipeline"] .pipeline-agent-indicator');
  getPipelineStatus().then(status => {
    if (!status || !status.agents) {
      document.querySelectorAll(".pipeline-agent-card").forEach(c => {
        c.querySelector(".pipeline-status-dot").className = "pipeline-status-dot offline";
        c.querySelector(".run-count").textContent = "—";
        c.querySelector(".item-count").textContent = "—";
        c.querySelector(".last-run").textContent = "offline";
      });
      if (statusEl) statusEl.className = "pipeline-agent-indicator offline";
      return;
    }
    for (const [name, agent] of Object.entries(status.agents)) {
      const card = document.querySelector(`.pipeline-agent-card[data-agent="${name}"]`);
      if (!card) continue;
      card.querySelector(".pipeline-status-dot").className = `pipeline-status-dot ${agent.status}`;
      card.querySelector(".run-count").textContent = agent.runCount || 0;
      card.querySelector(".item-count").textContent = agent.itemsProcessed || 0;
      card.querySelector(".last-run").textContent = agent.lastRun ? new Date(agent.lastRun).toLocaleString("en-IN") : "never";
      const errEl = card.querySelector(".pipeline-agent-error");
      if (agent.lastError) { errEl.textContent = agent.lastError; errEl.classList.remove("hidden"); }
      else errEl.classList.add("hidden");
    }
    // Score deltas
    if (status.lastScoreResult?.deltas) {
      renderScoreDeltas(status.lastScoreResult.deltas);
    }
    if (statusEl) statusEl.className = `pipeline-agent-indicator ${Object.values(status.agents).some(a => a.status === "running") ? "running" : "idle"}`;
  });
}

function renderPipelineLog() {
  const container = $("pipelineLog");
  if (!container) return;
  getPipelineLog(30).then(entries => {
    if (!entries.length) { container.innerHTML = '<p class="note">No pipeline activity yet. Run an agent to see logs.</p>'; return; }
    container.innerHTML = entries.map(e => {
      const ts = new Date(e.timestamp).toLocaleTimeString("en-IN");
      const cls = e.type === "error" ? "log-error" : e.type === "warn" ? "log-warn" : "log-info";
      return `<div class="pipeline-log-entry ${cls}"><span class="log-time">${ts}</span><span class="log-agent">[${e.agent}]</span><span class="log-msg">${escapeHtml(e.message)}</span></div>`;
    }).join("");
  });
}

function renderScoreDeltas(deltas) {
  const container = $("pipelineScoreDeltas");
  if (!container || !deltas.length) return;
  container.innerHTML = deltas.slice(0, 10).map(d => {
    const pct = Math.min(100, (d.signalDelta / 20) * 100);
    const label = d.signalDelta >= 15 ? "Strong" : d.signalDelta >= 10 ? "Moderate" : d.signalDelta >= 5 ? "Weak" : "Minimal";
    return `<div class="score-delta-card">
      <div class="score-delta-header"><strong>${escapeHtml(d.city)}</strong><span>${escapeHtml(d.category)}</span></div>
      <div class="score-delta-bar"><div class="score-delta-fill" style="width:${pct}%"></div></div>
      <div class="score-delta-meta">
        <span class="delta-label">${label} (${d.signalDelta > 0 ? "+" : ""}${d.signalDelta})</span>
        <span>${d.totalEvidence} items · ${d.sourceDiversity} sources</span>
      </div>
    </div>`;
  }).join("");
}

function renderPipelineWidget() {
  const container = $("pipelineWidgetContent");
  if (!container) return;
  const base = getRagApiUrl();
  if (!base) {
    container.innerHTML = '<p class="note">Save a backend endpoint to see live pipeline status here.</p>';
    return;
  }
  getPipelineStatus().then(status => {
    if (!status || !status.agents) {
      container.innerHTML = '<p class="note">Pipeline backend not responding.</p>';
      return;
    }
    container.innerHTML = Object.entries(status.agents).map(([name, agent]) => `
      <div class="pipeline-mini-card">
        <div class="pipeline-mini-header">
          <span class="pipeline-status-dot ${agent.status}"></span>
          <strong>${name}</strong>
        </div>
        <div class="pipeline-mini-stats">
          <span>${agent.runCount || 0} runs</span>
          <span>${agent.itemsProcessed || 0} items</span>
          <span class="last">${agent.lastRun ? new Date(agent.lastRun).toLocaleString("en-IN") : "never"}</span>
        </div>
      </div>
    `).join("");
  });
}

// ===== OBSERVABILITY DASHBOARD =====

let observabilityTimer = null;
let observabilityLastFetch = null;

async function getObservabilityMetrics() {
  const base = getRagApiUrl();
  if (!base) return null;
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 3000);
    const r = await fetch(`${base}/metrics`, { signal: c.signal }); clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function getHealthStatus() {
  const base = getRagApiUrl();
  if (!base) return { status: "offline" };
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 3000);
    const r = await fetch(`${base}/healthz`, { signal: c.signal }); clearTimeout(t);
    if (!r.ok) return { status: r.status === 503 ? "unhealthy" : "degraded", response: r.status };
    return await r.json();
  } catch { return { status: "offline" }; }
}

function formatUptime(sec) {
  if (!sec && sec !== 0) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec/60)}m ${sec%60}s`;
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  return `${h}h ${m}m`;
}

function formatRelative(ms) {
  if (!ms && ms !== 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms/60000)}m`;
  return `${Math.floor(ms/3600000)}h`;
}

function renderObservability() {
  const strip = $("obsStatusStrip");
  if (!strip) return;

  Promise.all([getHealthStatus(), getObservabilityMetrics(), getPipelineStatus()]).then(([health, metrics, pipeline]) => {
    const isOnline = health?.status === "healthy" || health?.status === "degraded";
    const dot = $("navHealthDot");
    if (dot) {
      dot.className = `health-dot ${health?.status || "offline"}`;
    }

    const badge = $("obsHealthBadge");
    if (badge) {
      badge.textContent = health?.status || "offline";
      badge.className = `obs-status-value ${health?.status || "offline"}`;
    }

    $("obsUptime").textContent = formatUptime(metrics?.uptimeSec);
    $("obsTotalReqs").textContent = metrics?.total?.requests ?? "—";
    const errEl = $("obsErrorRate");
    if (errEl) {
      const errRate = metrics?.total?.errorRate ?? "0";
      errEl.textContent = `${errRate}%`;
      const errNum = parseFloat(errRate);
      errEl.className = `obs-status-value ${errNum > 5 ? "unhealthy" : errNum > 0 ? "degraded" : "healthy"}`;
    }
    $("obsPipelineRuns").textContent = metrics?.total?.pipelineRuns ?? "—";
    $("obsP95").textContent = metrics?.latency?.p95Ms != null ? `${metrics.latency.p95Ms}ms` : "—";

    // Endpoint latency table
    const epTable = $("obsEndpointTable");
    if (epTable && metrics?.endpoints) {
      epTable.innerHTML = `
        <table>
          <thead><tr><th>Endpoint</th><th>Method</th><th>Count</th><th>p50</th><th>p95</th><th>p99</th><th>Avg</th><th>Errors</th><th>Last</th></tr></thead>
          <tbody>
          ${metrics.endpoints.slice(0, 20).map(e => {
            const status = e.errors > 0 ? "error" : e.p95Ms > 1000 ? "warn" : "ok";
            const last = e.lastCalled ? new Date(e.lastCalled).toLocaleTimeString("en-IN") : "—";
            return `<tr>
              <td class="endpoint-path">${escapeHtml(e.path)}</td>
              <td>${e.method}</td>
              <td>${e.count}</td>
              <td>${e.p50Ms}ms</td>
              <td>${e.p95Ms}ms</td>
              <td>${e.p99Ms}ms</td>
              <td>${e.avgMs}ms</td>
              <td class="${status}">${e.errors} (${e.errorRate}%)</td>
              <td>${last}</td>
            </tr>`;
          }).join("")}
          </tbody>
        </table>
      `;
    }

    // Data quality
    const dq = $("obsDataQuality");
    if (dq && health?.checks) {
      const ev = health.checks.evidence_store;
      const disk = health.checks.disk;
      const files = health.checks.files || [];
      const requiredFiles = files.filter(f => f.required);
      const filesOk = requiredFiles.every(f => f.status === "ok");
      const totalFileMb = (files.reduce((s,f) => s + (f.sizeBytes||0), 0) / 1024 / 1024).toFixed(1);
      dq.innerHTML = `
        <div class="dq-card">
          <div class="dq-label">Evidence records</div>
          <div class="dq-value">${ev?.recordCount ?? 0}</div>
          <div class="dq-bar"><div class="dq-bar-fill" style="width:${Math.min(100, (ev?.recordCount||0)/20)}%"></div></div>
        </div>
        <div class="dq-card">
          <div class="dq-label">Evidence freshness</div>
          <div class="dq-value">${formatRelative(ev?.ageMs)} ago</div>
          <div class="dq-bar"><div class="dq-bar-fill" style="width:${ev?.freshness === "fresh" ? 90 : ev?.freshness === "stale" ? 40 : 10}%"></div></div>
        </div>
        <div class="dq-card">
          <div class="dq-label">Required data files</div>
          <div class="dq-value">${requiredFiles.length}/${requiredFiles.length} ${filesOk ? "✓" : "✗"}</div>
          <div class="dq-bar"><div class="dq-bar-fill" style="width:${filesOk ? 100 : 50}%"></div></div>
        </div>
        <div class="dq-card">
          <div class="dq-label">Total data size</div>
          <div class="dq-value">${totalFileMb} MB</div>
          <div class="dq-bar"><div class="dq-bar-fill" style="width:60%"></div></div>
        </div>
        <div class="dq-card">
          <div class="dq-label">Disk writable</div>
          <div class="dq-value">${disk?.status === "ok" ? "Yes" : "No"}</div>
          <div class="dq-bar"><div class="dq-bar-fill" style="width:${disk?.status === "ok" ? 100 : 5}%"></div></div>
        </div>
        <div class="dq-card">
          <div class="dq-label">Health check</div>
          <div class="dq-value">${health.responseTimeMs ?? 0}ms</div>
          <div class="dq-bar"><div class="dq-bar-fill" style="width:${Math.min(100, (health.responseTimeMs||0)/5)}%"></div></div>
        </div>
      `;
    }

    // Activity log (synthesize from metrics + pipeline)
    const act = $("obsActivityLog");
    if (act) {
      const activities = [];
      if (metrics?.endpoints) {
        for (const e of metrics.endpoints.slice(0, 15)) {
          activities.push({
            time: e.lastCalled,
            method: e.method,
            path: e.path,
            duration: e.lastDurationMs,
            status: e.lastStatus
          });
        }
      }
      if (pipeline?.lastIngestionResult) {
        activities.push({
          time: Date.now() - 1000,
          method: "AGENT",
          path: "ingestion",
          duration: pipeline.lastIngestionResult.durationMs || 0,
          status: 200,
          extra: `${pipeline.lastIngestionResult.newEvidence} new / ${pipeline.lastIngestionResult.totalRecords} total`
        });
      }
      if (pipeline?.lastScoreResult) {
        activities.push({
          time: Date.now() - 500,
          method: "AGENT",
          path: "score",
          duration: pipeline.lastScoreResult.durationMs || 0,
          status: 200,
          extra: `${pipeline.lastScoreResult.deltas?.length || 0} deltas`
        });
      }
      activities.sort((a,b) => (b.time||0) - (a.time||0));
      if (!activities.length) {
        act.innerHTML = `<p class="note">No activity yet. Run an agent or hit an endpoint.</p>`;
      } else {
        act.innerHTML = activities.slice(0, 25).map(a => {
          const ts = a.time ? new Date(a.time).toLocaleTimeString("en-IN") : "—";
          const statusCls = a.status >= 500 ? "error" : a.status >= 400 ? "warn" : "ok";
          return `<div class="obs-activity-entry">
            <span class="act-time">${ts}</span>
            <span class="act-method">${a.method}</span>
            <span class="act-path">${escapeHtml(a.path)} ${a.extra ? `<small>(${escapeHtml(a.extra)})</small>` : ""}</span>
            <span class="act-duration"><span class="act-status ${statusCls}">${a.status}</span> ${a.duration}ms</span>
          </div>`;
        }).join("");
      }
    }

    // Pipeline health
    const ph = $("obsPipelineHealth");
    if (ph && pipeline?.agents) {
      ph.innerHTML = Object.entries(pipeline.agents).map(([name, agent]) => {
        const statusColor = agent.status === "online" || agent.status === "idle" ? "#22c55e" :
          agent.status === "running" ? "#f59e0b" :
          agent.status === "error" ? "#ef4444" : "#6b7280";
        return `<div class="obs-pipeline-agent">
          <div class="pa-name"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:6px;"></span>${escapeHtml(name)}</div>
          <div class="pa-stat">${agent.status} · ${agent.runCount||0} runs · ${agent.itemsProcessed||0} items</div>
          <div class="pa-stat">${agent.lastRun ? `Last: ${new Date(agent.lastRun).toLocaleString("en-IN")}` : "Never run"}</div>
          ${agent.lastError ? `<div class="pa-stat" style="color:#f87171;">⚠ ${escapeHtml(agent.lastError)}</div>` : ""}
        </div>`;
      }).join("");
    }

    observabilityLastFetch = Date.now();
  });
  loadAlerts();
  loadRateLimitInfo();
  loadBriefCacheStats();
}

function startObservabilityLoop() {
  if (observabilityTimer) clearInterval(observabilityTimer);
  renderObservability();
  observabilityTimer = setInterval(renderObservability, 5000);
}

function stopObservabilityLoop() {
  if (observabilityTimer) clearInterval(observabilityTimer);
  observabilityTimer = null;
}

let wsClient = null;
let wsReconnectTimer = null;
let wsConnected = false;
let lastAlertsCount = 0;

function connectWebSocket() {
  if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) return;
  const base = (localStorage.getItem("bharatRagApiUrl") || "http://127.0.0.1:8787").replace(/\/+$/, "");
  const wsUrl = base.replace(/^http/, "ws") + "/ws";
  try {
    wsClient = new WebSocket(wsUrl);
  } catch (e) {
    console.warn("[ws] connect failed:", e.message);
    scheduleWsReconnect();
    return;
  }
  wsClient.onopen = () => {
    wsConnected = true;
    console.log("[ws] connected to", wsUrl);
    const dot = $("wsStatusDot");
    if (dot) { dot.className = "ws-dot connected"; dot.title = "WebSocket connected"; }
  };
  wsClient.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      handleWsMessage(msg);
    } catch {}
  };
  wsClient.onclose = () => {
    wsConnected = false;
    const dot = $("wsStatusDot");
    if (dot) { dot.className = "ws-dot disconnected"; dot.title = "WebSocket disconnected"; }
    scheduleWsReconnect();
  };
  wsClient.onerror = (e) => {
    console.warn("[ws] error:", e?.message || e);
  };
}

function scheduleWsReconnect() {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    connectWebSocket();
  }, 5000);
}

function handleWsMessage(msg) {
  if (!msg || !msg.type) return;
  if (msg.type === "snapshot" || msg.type === "subscribed") {
    if (msg.alerts) {
      const newCount = msg.alerts.count || 0;
      if (newCount > lastAlertsCount) {
        for (const a of msg.alerts.alerts.slice(0, newCount - lastAlertsCount)) {
          showToast(a.severity === "critical" ? "error" : "warn", `Alert: ${a.message}`);
        }
        lastAlertsCount = newCount;
      }
      renderAlertsPanel(msg.alerts);
    }
    if (msg.metrics) {
      const wsStats = $("wsLiveStats");
      if (wsStats) {
        wsStats.innerHTML = `<span class="ws-stat">WS: <b>${wsConnected ? "live" : "offline"}</b></span><span class="ws-stat">p95: <b>${msg.metrics.latency?.p95Ms ?? "—"}ms</b></span><span class="ws-stat">runs: <b>${msg.metrics.total?.pipelineRuns ?? 0}</b></span>`;
      }
    }
  } else if (msg.type === "event" && msg.result) {
    const r = msg.result;
    if (r.newEvidence !== undefined) {
      showToast("success", `Pipeline run: ${r.newEvidence} new evidence / ${r.totalRecords} total`);
    }
  }
}

async function loadAlerts() {
  const data = await ragFetch("/alerts", { timeoutMs: 2000, fallback: null });
  if (data) renderAlertsPanel(data);
}

function renderAlertsPanel(alertsData) {
  const panel = $("alertsPanel");
  if (!panel) return;
  if (!alertsData || !alertsData.alerts?.length) {
    panel.innerHTML = `<p class="note">No active alerts. System healthy.</p>`;
    return;
  }
  panel.innerHTML = `
    <div class="alerts-header">
      <span class="alerts-count">${alertsData.count} active</span>
      <span class="alerts-crit">${alertsData.critical} critical</span>
      <span class="alerts-warn">${alertsData.warning} warning</span>
      <button class="btn-mini" id="ackAllAlerts">Ack all</button>
    </div>
    <div class="alerts-list">
      ${alertsData.alerts.slice(0, 10).map(a => `
        <div class="alert-item ${a.severity}">
          <span class="alert-sev">${a.severity.toUpperCase()}</span>
          <span class="alert-rule">${escapeHtml(a.rule)}</span>
          <span class="alert-msg">${escapeHtml(a.message)}</span>
          <span class="alert-time">${new Date(a.timestamp).toLocaleTimeString("en-IN")}</span>
        </div>
      `).join("")}
    </div>
  `;
  $("ackAllAlerts")?.addEventListener("click", ackAllAlerts);
}

async function ackAllAlerts() {
  await ragFetch("/alerts/ack", { method: "POST", body: { id: "all" }, timeoutMs: 2000, fallback: null });
  await loadAlerts();
}

function showToast(tone, message) {
  let toastContainer = $("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

async function loadRateLimitInfo() {
  const data = await ragFetch("/rate-limit", { timeoutMs: 2000, fallback: null });
  if (data) {
    const el = $("rateLimitInfo");
    if (el) el.innerHTML = `Rate limit: <b>${data.perIp.capacity} req/IP</b> · <b>${data.perIp.activeIps}</b> active IPs · global <b>${data.global.tokens}/${data.global.capacity}</b>`;
  }
}

async function loadBriefCacheStats() {
  const data = await ragFetch("/cache/brief", { timeoutMs: 2000, fallback: null });
  if (data) {
    const el = $("briefCacheInfo");
    if (el) el.innerHTML = `Brief cache: <b>${data.size}</b> entries · <b>${data.hits}</b> hits · <b>${data.misses}</b> misses · <b>${data.evictions}</b> evictions`;
  }
}

async function init() {
  const [market, seed, rag] = await Promise.all([
    loadJson("data/public_market_data.json", FALLBACK_MARKET_DATA),
    loadJson("data/city_language_seed.json", FALLBACK_SEED_DATA),
    loadJson("data/rag_evidence_layer.json", { connectors: [], jobs: [], sampleEvidence: [] })
  ]);
  marketData = market;
  seedData = seed;
  ragEvidenceLayer = rag;
  populatePlatformControls();
  populateSeedControls();
  populateConsumerSignalControls();
  populatePriceWatchControls();
  populateRagControls();
  const savedNote = localStorage.getItem("caLearningNote");
  if (savedNote && $("caLearningNote")) $("caLearningNote").value = savedNote;
  setActivePlatform("blinkit");
  renderKpis();
  renderPlatformIntelligence();
  renderCampaignStatus();
  renderMarketPulse();
  renderProofCards();
  renderSources();
  renderScore();
  renderCampaignAutopilot();
  renderVideoCampaignStudio();
  renderGeoSalesCommandCenter();
  renderExperimentPlan();
  renderUnitEconomics();
  renderReport();
  renderOeSignals();
  renderPriceWatchTable();
  renderPriceWatchAlerts();
  renderPriceWatchTrend();
  renderBenchmarkCockpit();
  renderRagLayer();
  attachEvents();
  if ($("three-overlay") && !$("three-overlay").classList.contains("hidden")) {
    setView(null);
  } else {
    showLanding();
  }
  await loadMarketSignals();
  getHealthStatus().then(h => {
    const dot = $("navHealthDot");
    if (dot) dot.className = `health-dot ${h.status || "offline"}`;
  }).catch(() => {});

  connectWebSocket();
  Promise.all([loadAlerts(), loadRateLimitInfo(), loadBriefCacheStats()]);
}

window.enterDashboard = enterDashboard;
window.goToDashboardTab = showTab;
window.showBrandMap = showBrandMap;
window.showLanding = showLanding;
init();

const SIGNAL_TYPE_LABELS = {
  "GOV/GMV/revenue update": "GOV / Revenue",
  "order volume/user growth": "Order Volume",
  "dark store/expansion update": "Expansion",
  "profitability/loss/margin": "Profitability",
  "retail media/advertising signal": "Retail Media",
  "funding/investment": "Funding",
  "shutdown/distress/cautionary signal": "Shutdown / Distress",
  "competitive move": "Competition",
  "consumer behavior signal": "Consumer Behavior",
  "regulatory/legal/policy signal": "Regulatory",
  "operational risk signal": "Operational Risk",
  "product/category expansion": "Category Expansion",
  "ipo_milestone": "IPO",
  "partnership/acquisition": "Partnership",
  "local language/vernacular marketing signal": "Vernacular"
};

const BRAND_MATCH = {
  "Blinkit": ["Blinkit", "Eternal"],
  "Swiggy Instamart": ["Swiggy Instamart", "Swiggy"],
  "Zepto": ["Zepto"],
  "BigBasket": ["BigBasket", "BigBasket Now", "BigBasket B2C", "BB Now"],
  "Dunzo": ["Dunzo"],
  "Industry": ["Industry", "Meta", "WhatsApp"]
};

function getSignalBrandGroup(signal) {
  const b = signal.brand || "";
  for (const [group, aliases] of Object.entries(BRAND_MATCH)) {
    if (aliases.some(a => b.includes(a))) return group;
  }
  return "Industry";
}

function filterSignals() {
  if (!marketSignals || !marketSignals.signals) return [];
  const brandFilter = $("signalBrandFilter").value;
  const typeFilter = $("signalTypeFilter").value;
  const confFilter = $("signalConfFilter").value;
  const needsVal = $("signalNeedsValidation").checked;
  return marketSignals.signals.filter(s => {
    if (brandFilter !== "all" && getSignalBrandGroup(s) !== brandFilter) return false;
    if (typeFilter !== "all" && s.event_type !== typeFilter) return false;
    if (confFilter !== "all" && s.confidence !== confFilter) return false;
    if (needsVal && !s.needs_validation) return false;
    return true;
  });
}

function renderTopSignals() {
  const filtered = filterSignals();
  const top10 = filtered.sort((a, b) => b.business_impact_score - a.business_impact_score).slice(0, 10);
  $("signalTopList").innerHTML = top10.map(s => {
    const impactClass = s.business_impact_score >= 90 ? "high" : s.business_impact_score >= 75 ? "medium" : "low";
    const confClass = "conf-" + s.confidence.toLowerCase();
    const brandTag = getSignalBrandGroup(s);
    const typeLabel = SIGNAL_TYPE_LABELS[s.event_type] || s.event_type;
    return `<div class="signal-item" data-signal-id="${escapeHtml(s.id)}">
      <div class="signal-impact-badge ${impactClass}">${s.business_impact_score}</div>
      <div class="signal-item-body">
        <div class="signal-item-title">${escapeHtml(s.signal_summary)}</div>
        <div class="signal-item-meta">
          <span class="signal-tag ${confClass}">${s.confidence}</span>
          <span class="signal-tag brand-tag">${escapeHtml(brandTag)}</span>
          <span class="signal-tag type-tag">${escapeHtml(typeLabel)}</span>
          ${s.hard_metric_available ? `<span class="signal-metric">${escapeHtml(s.metric_name)}: ${escapeHtml(s.metric_value)}</span>` : ""}
          ${s.needs_validation ? `<span class="signal-needs-validation">&#9888; Needs validation</span>` : ""}
          <span style="color:var(--muted-2)">${escapeHtml(s.date_published)}</span>
        </div>
      </div>
    </div>`;
  }).join("");
  $("signalTopList").querySelectorAll(".signal-item").forEach(el => {
    el.addEventListener("click", () => openSignalDetail(el.dataset.signalId));
  });
}

function renderSignalTimeline() {
  const filtered = filterSignals();
  const months = {};
  const monthOrder = ["2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05"];
  monthOrder.forEach(m => { months[m] = []; });
  filtered.forEach(s => {
    const m = (s.date_published || "").substring(0, 7);
    if (months[m]) months[m].push(s);
    else { const nearest = monthOrder.filter(x => x <= m).pop(); if (nearest) months[nearest].push(s); }
  });
  const monthNames = {"2025-05":"May 2025","2025-06":"Jun 2025","2025-07":"Jul 2025","2025-08":"Aug 2025","2025-09":"Sep 2025","2025-10":"Oct 2025","2025-11":"Nov 2025","2025-12":"Dec 2025","2026-01":"Jan 2026","2026-02":"Feb 2026","2026-03":"Mar 2026","2026-04":"Apr 2026","2026-05":"May 2026"};
  $("signalTimeline").innerHTML = monthOrder.map(m => {
    const items = months[m] || [];
    if (items.length === 0) return `<div class="signal-timeline-month"><div class="signal-timeline-month-label">${monthNames[m]}</div><div class="signal-timeline-items"><div class="signal-timeline-entry" style="opacity:0.5">No strong public signal found.</div></div></div>`;
    return `<div class="signal-timeline-month"><div class="signal-timeline-month-label">${monthNames[m]}</div><div class="signal-timeline-items">${items.map(s => {
      const confC = "conf-" + s.confidence.toLowerCase();
      return `<div class="signal-timeline-entry" data-signal-id="${escapeHtml(s.id)}"><span class="signal-tag ${confC}" style="margin-right:4px">${s.confidence}</span> ${escapeHtml(s.signal_summary.substring(0, 120))}${s.signal_summary.length > 120 ? "..." : ""}</div>`;
    }).join("")}</div></div>`;
  }).join("");
  $("signalTimeline").querySelectorAll("[data-signal-id]").forEach(el => {
    el.addEventListener("click", () => openSignalDetail(el.dataset.signalId));
  });
}

function renderSignalBrandMap() {
  if (!marketSignals || !marketSignals.platformIntelligence) return;
  const filtered = filterSignals();
  const brandGroups = {};
  filtered.forEach(s => {
    const g = getSignalBrandGroup(s);
    if (!brandGroups[g]) brandGroups[g] = [];
    brandGroups[g].push(s);
  });
  $("signalBrandMap").innerHTML = marketSignals.platformIntelligence.map(p => {
    const matchBrand = p.id === "blinkit" ? "Blinkit" : p.id === "instamart" ? "Swiggy Instamart" : p.id === "zepto" ? "Zepto" : p.id === "bigbasket_now" ? "BigBasket" : p.id === "dunzo" ? "Dunzo" : "Industry";
    const signals = brandGroups[matchBrand] || [];
    return `<div class="signal-brand-card" data-brand="${escapeHtml(p.id)}">
      <div class="signal-brand-card-title">${escapeHtml(p.name)}</div>
      <div class="signal-brand-card-role">${escapeHtml(p.currentRole)}</div>
      <div class="signal-brand-card-count">${signals.length} signal${signals.length !== 1 ? "s" : ""} &middot; Confidence: ${p.sourceQuality}</div>
      <div class="signal-brand-card-metrics">${p.publicMetrics ? p.publicMetrics.slice(0, 3).map(m => escapeHtml(m)).join("<br>") : ""}</div>
    </div>`;
  }).join("");
}

function openSignalDetail(signalId) {
  if (!marketSignals || !marketSignals.signals) return;
  const s = marketSignals.signals.find(sig => sig.id === signalId);
  if (!s) return;
  const brandTag = getSignalBrandGroup(s);
  const typeLabel = SIGNAL_TYPE_LABELS[s.event_type] || s.event_type;
  const moduleLabels = {"Opportunity Engine":"OE","Benchmark Cockpit":"Cockpit","Campaign Autopilot":"Autopilot","Measurement Tracker":"Tracker","Evidence Ledger":"Evidence","Executive Decision Brief":"Brief"};
  const oeSignal = s.dashboard_module_mapping && s.dashboard_module_mapping.includes("Opportunity Engine");
  const cockpitSignal = s.dashboard_module_mapping && s.dashboard_module_mapping.includes("Benchmark Cockpit");
  const autopilotSignal = s.dashboard_module_mapping && s.dashboard_module_mapping.includes("Campaign Autopilot");
  let oeAction = "";
  if (oeSignal && (s.confidence === "A" || s.confidence === "B")) {
    oeAction = `<div class="signal-detail-section"><div class="signal-detail-label">Opportunity Engine Impact</div><div class="signal-detail-value" style="color:var(--success)">Confidence can be upgraded to ${s.confidence} based on this signal.</div></div>`;
  } else if (oeSignal) {
    oeAction = `<div class="signal-detail-section"><div class="signal-detail-label">Opportunity Engine Impact</div><div class="signal-detail-value" style="color:#fbbf24">Signal noted, but confidence ${s.confidence} is not sufficient to upgrade dashboard confidence.</div></div>`;
  }
  let cockpitAction = "";
  if (cockpitSignal) {
    cockpitAction = `<div class="signal-detail-section"><div class="signal-detail-label">Benchmark Cockpit</div><div class="signal-detail-value">${escapeHtml(s.recommended_dashboard_action || "Add to brand benchmark detail panel.")}</div></div>`;
  }
  let autopilotAction = "";
  if (autopilotSignal) {
    autopilotAction = `<div class="signal-detail-section"><div class="signal-detail-label">Campaign Autopilot</div><div class="signal-detail-value" style="color:#fbbf24">&#9888; Signal-informed recommendation — review before use.</div><div class="signal-detail-value">${escapeHtml(s.signal_summary)}</div></div>`;
  }
  $("signalModalBody").innerHTML = `
    <div class="signal-detail-section"><div class="signal-detail-label">Signal</div><div class="signal-detail-value" style="font-size:16px;font-weight:600">${escapeHtml(s.signal_summary)}</div></div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <span class="signal-tag conf-${s.confidence.toLowerCase()}">Confidence: ${s.confidence}</span>
      <span class="signal-tag brand-tag">${escapeHtml(brandTag)}</span>
      <span class="signal-tag type-tag">${escapeHtml(typeLabel)}</span>
      <span class="signal-impact-badge ${s.business_impact_score >= 90 ? "high" : s.business_impact_score >= 75 ? "medium" : "low"}">${s.business_impact_score}</span>
      ${s.needs_validation ? `<span class="signal-needs-validation">&#9888; Needs validation</span>` : ""}
    </div>
    ${s.hard_metric_available ? `<div class="signal-detail-section"><div class="signal-detail-label">Metric</div><div class="signal-detail-metric">${escapeHtml(s.metric_name)}: ${escapeHtml(s.metric_value)}${s.metric_unit ? " " + escapeHtml(s.metric_unit) : ""}</div><div style="font-size:12px;color:var(--muted-2);margin-top:2px">Type: ${escapeHtml(s.metric_type || "N/A")}</div></div>` : ""}
    <div class="signal-detail-section"><div class="signal-detail-label">Date Published</div><div class="signal-detail-value">${escapeHtml(s.date_published || "N/A")}</div></div>
    <div class="signal-detail-section"><div class="signal-detail-label">Source</div><div class="signal-detail-value">${escapeHtml(s.source_name || "N/A")}${s.source_url ? ` — <a href="${escapeHtml(s.source_url)}" target="_blank" rel="noopener">View source</a>` : ""}</div></div>
    <div class="signal-detail-section"><div class="signal-detail-label">Dashboard Modules</div><div class="signal-detail-modules">${(s.dashboard_module_mapping || []).map(m => `<span class="signal-module-tag">${moduleLabels[m] || m}</span>`).join("")}</div></div>
    ${oeAction}${cockpitAction}${autopilotAction}
    ${s.limitation_or_caveat ? `<div class="signal-detail-section"><div class="signal-detail-label">Caveat</div><div class="signal-caveat">${escapeHtml(s.limitation_or_caveat)}</div></div>` : ""}
    <div class="signal-detail-section"><div class="signal-detail-label">Recommended Action</div><div class="signal-detail-value">${escapeHtml(s.recommended_dashboard_action || "No specific action recommended.")}</div></div>
  `;
  $("signalDetailModal").classList.remove("hidden");
}

function renderSourceAudit() {
  if (!marketSignals || !marketSignals.sources) return;
  const validationSignals = marketSignals.signals.filter(s => s.needs_validation);
  const body = `<div class="signal-detail-section" style="margin-bottom:20px"><div class="signal-detail-label" style="font-size:14px;font-weight:700;color:var(--text)">Sources (${marketSignals.sources.length})</div></div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="border-bottom:2px solid var(--card-border)"><th style="text-align:left;padding:8px;color:var(--muted-2)">Source</th><th style="text-align:left;padding:8px;color:var(--muted-2)">Type</th><th style="text-align:left;padding:8px;color:var(--muted-2)">Confidence</th></tr></thead>
    <tbody>${marketSignals.sources.map(src => `<tr style="border-bottom:1px solid var(--card-border)"><td style="padding:8px;color:var(--text)">${escapeHtml(src.name)}</td><td style="padding:8px;color:var(--text-secondary)">${escapeHtml(src.type)}</td><td style="padding:8px"><span class="signal-tag conf-${src.confidence.toLowerCase()}">${src.confidence}</span></td></tr>`).join("")}</tbody></table>
    <div class="signal-detail-section" style="margin-top:24px"><div class="signal-detail-label" style="font-size:14px;font-weight:700;color:var(--text)">Signals Needing Validation (${validationSignals.length})</div></div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="border-bottom:2px solid var(--card-border)"><th style="text-align:left;padding:8px;color:var(--muted-2)">ID</th><th style="text-align:left;padding:8px;color:var(--muted-2)">Brand</th><th style="text-align:left;padding:8px;color:var(--muted-2)">Signal</th><th style="text-align:left;padding:8px;color:var(--muted-2)">Caveat</th></tr></thead>
    <tbody>${validationSignals.map(s => `<tr style="border-bottom:1px solid var(--card-border)"><td style="padding:8px;color:var(--text-secondary)">${escapeHtml(s.id)}</td><td style="padding:8px;color:var(--text)">${escapeHtml(s.brand)}</td><td style="padding:8px;color:var(--text)">${escapeHtml(s.signal_summary.substring(0, 80))}...</td><td style="padding:8px;color:#fbbf24;font-size:12px">${escapeHtml((s.limitation_or_caveat || "").substring(0, 80))}...</td></tr>`).join("")}</tbody></table>`;
  $("signalModalBody").innerHTML = body;
  $("signalDetailModal").classList.remove("hidden");
}

function updateOEEvidenceFromSignals() {
  if (!marketSignals || !marketSignals.signals) return;
  const signalRows = marketSignals.signals.filter(s => s.confidence === "A" || s.confidence === "B").slice(0, 10).map(s => ({
    source: `${s.brand} — ${s.signal_summary.substring(0, 60)}`,
    what: s.hard_metric_available ? `${s.metric_name}: ${s.metric_value}` : "Directional signal",
    confidence: s.confidence,
    limitation: s.needs_validation ? "Needs validation" : ""
  }));
  if (signalRows.length > 0) {
    const existingLedger = $("oeEvidenceLedger");
    if (existingLedger) {
      const signalHtml = signalRows.map(r => `<div class="oe-evidence-row"><span class="oe-evidence-source">${escapeHtml(r.source)}</span><span class="oe-evidence-what">${escapeHtml(r.what)}</span><span class="oe-evidence-conf conf-${r.confidence.toLowerCase()}">${r.confidence}</span></div>`).join("");
      existingLedger.innerHTML += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--card-border)"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted-2);margin-bottom:6px">From Market Signal Layer</div>${signalHtml}</div>`;
    }
  }
}

function updateCockpitFromSignals() {
  if (!marketSignals || !marketSignals.platformIntelligence) return;
  const container = $("bmCockpitGrid");
  if (!container) return;
  container.querySelectorAll(".bm-cockpit-card").forEach(card => {
    const platformId = card.dataset.platform;
    const matchBrand = platformId === "blinkit" ? "Blinkit" : platformId === "instamart" ? "Swiggy Instamart" : platformId === "zepto" ? "Zepto" : platformId === "bigbasket_now" ? "BigBasket" : platformId === "dunzo" ? "Dunzo" : "Industry";
    const platformSignals = marketSignals.signals.filter(s => getSignalBrandGroup(s) === matchBrand);
    if (platformSignals.length > 0) {
      const existing = card.querySelector(".signal-count-badge");
      if (existing) existing.textContent = `${platformSignals.length}`;
      else {
        const countEl = document.createElement("div");
        countEl.className = "signal-count-badge";
        countEl.style.cssText = "position:absolute;top:8px;right:8px;background:var(--theme-primary);color:var(--theme-text-on-primary);font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;";
        countEl.textContent = `${platformSignals.length}`;
        card.style.position = "relative";
        card.appendChild(countEl);
      }
    }
  });
}

function updateAutopilotFromSignals() {
  if (!marketSignals || !marketSignals.signals) return;
  const autopilotSignals = marketSignals.signals.filter(s => s.dashboard_module_mapping && s.dashboard_module_mapping.includes("Campaign Autopilot") && (s.confidence === "A" || s.confidence === "B")).slice(0, 5);
  if (autopilotSignals.length === 0) return;
  const draftArea = $("caDrafts");
  if (!draftArea) return;
  const existingHint = draftArea.querySelector(".signal-autopilot-hint");
  if (existingHint) return;
  const noteEl = draftArea.querySelector(".note");
  if (!noteEl) return;
  const hintEl = document.createElement("div");
  hintEl.className = "signal-autopilot-hint";
  hintEl.style.cssText = "background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--muted-2);line-height:1.5";
  hintEl.innerHTML = `<strong style="color:#fbbf24">Signal-informed recommendation — review before use:</strong><br>${autopilotSignals.map(s => `&#8226; ${escapeHtml(s.signal_summary.substring(0, 100))}`).join("<br>")}`;
  noteEl.parentNode.insertBefore(hintEl, noteEl.nextSibling);
}

async function loadMarketSignals() {
  try {
    const response = await fetch("data/market_signals_2025_2026.json");
    if (!response.ok) throw new Error("Failed to load signals");
    marketSignals = await response.json();
    renderTopSignals();
    renderSignalTimeline();
    renderSignalBrandMap();
    updateOEEvidenceFromSignals();
    updateCockpitFromSignals();
    updateAutopilotFromSignals();
  } catch (err) {
    console.warn("Could not load market signals:", err);
  }
}

/* ============================================================ */
/* CAMPAIGN FACTORY — live 5-agent chain UI                      */
/* ============================================================ */
const factoryState = {
  sse: null,
  sseOn: true,
  activeChainId: null,
  lastResult: null,
  history: []
};

function factoryLogLine(text, kind) {
  const log = document.getElementById("factoryChainLog");
  if (!log) return;
  const line = document.createElement("div");
  line.className = "log-line " + (kind || "");
  const ts = new Date().toLocaleTimeString();
  line.textContent = "[" + ts + "] " + text;
  log.appendChild(line);
  while (log.children.length > 200) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

function factorySetAgentStatus(agent, status, timeMs) {
  const node = document.querySelector('.factory-agent-node[data-agent="' + agent + '"]');
  if (!node) return;
  node.classList.remove("pending","running","complete","error");
  node.classList.add(status);
  const statusEl = node.querySelector(".factory-agent-status");
  if (statusEl) statusEl.textContent = status;
  const timeEl = node.querySelector(".factory-agent-time");
  if (timeEl) timeEl.textContent = timeMs != null ? (timeMs/1000).toFixed(1) + "s" : "";
}

function factoryResetChainVisual() {
  for (const a of ["research","audience","copy","channel","compliance"]) factorySetAgentStatus(a, "pending");
  const log = document.getElementById("factoryChainLog");
  if (log) log.innerHTML = "";
}

function factoryConnectSSE() {
  if (factoryState.sse) try { factoryState.sse.close(); } catch {}
  if (!factoryState.sseOn) return;
  try {
    const es = new EventSource("/api/campaign/events/stream");
    factoryState.sse = es;
    es.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      factoryHandleBusEvent(data);
    };
    es.onerror = () => { factoryLogLine("SSE disconnected", "chain_error"); };
  } catch (e) {
    factoryLogLine("SSE failed: " + e.message, "chain_error");
  }
}

function factoryHandleBusEvent(ev) {
  if (!ev || !ev.type) return;
  if (ev.type === "chain_start") {
    factoryState.activeChainId = ev.chainId;
    factoryResetChainVisual();
    factoryLogLine("Chain " + ev.chainId + " started for " + (ev.input?.brand || "") + "/" + (ev.input?.city || ""), "chain_start");
    return;
  }
  if (ev.type === "chain_stage_start") {
    factorySetAgentStatus(ev.stage, "running");
    factoryLogLine("▶ " + ev.stage + " (stage " + (ev.stageIndex + 1) + "/" + ev.totalStages + ")", "agent_start");
    return;
  }
  if (ev.type === "chain_stage_end") {
    factorySetAgentStatus(ev.stage, ev.status === "error" ? "error" : "complete", ev.durationMs);
    if (ev.error) factoryLogLine("✖ " + ev.stage + " failed: " + ev.error, "agent_error");
    else factoryLogLine("✓ " + ev.stage + " done in " + (ev.durationMs/1000).toFixed(1) + "s", "agent_complete");
    return;
  }
  if (ev.type === "chain_complete") {
    factoryLogLine("Chain complete in " + (ev.totalDurationMs/1000).toFixed(1) + "s, score " + ev.package?.overallScore + "/100", "chain_complete");
    factoryRenderResults(ev.package);
    factoryState.lastResult = ev.package;
    return;
  }
  if (ev.type === "chain_error") {
    factoryLogLine("Chain error: " + ev.error, "chain_error");
    return;
  }
  if (ev.type && ev.type.indexOf("agent_") === 0) {
    if (ev.type === "agent_warn") factoryLogLine("⚠ " + ev.agent + ": " + ev.message, "agent_warn");
    return;
  }
}

async function factoryCheckLLMStatus() {
  try {
    const r = await fetch("/api/llm/status");
    const j = await r.json();
    const el = document.getElementById("factoryChainLlmStatus");
    if (!el) return;
    if (j.anyAvailable) {
      const live = j.providers.filter(p => p.available).map(p => p.name + " (" + p.model + ")").join(", ");
      el.innerHTML = '<span style="color:#10b981;font-weight:600;">● Live</span> — ' + live;
    } else {
      el.innerHTML = '<span style="color:#f59e0b;">● No providers configured</span> — agents will run in fallback mode. ' + (j.setupHint || "");
    }
  } catch {}
}

async function factoryRunChain() {
  const btn = document.getElementById("factoryRunBtn");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Running..."; }
  factoryResetChainVisual();
  factoryLogLine("Initiating chain run...", "chain_start");
  const body = {
    brand: document.getElementById("factoryBrand")?.value,
    city: document.getElementById("factoryCity")?.value,
    category: document.getElementById("factoryCategory")?.value,
    language: document.getElementById("factoryLanguage")?.value,
    budget: Number(document.getElementById("factoryBudget")?.value || 50000),
    variantCount: Number(document.getElementById("factoryVariants")?.value || 5)
  };
  try {
    const r = await fetch("/api/campaign/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error("HTTP " + r.status + ": " + txt.slice(0, 200));
    }
    const result = await r.json();
    factoryState.lastResult = result;
    factoryRenderResults(result);
    factoryLogLine("Chain complete in " + (result.totalDurationMs/1000).toFixed(1) + "s, overall " + result.overallScore + "/100", "chain_complete");
  } catch (e) {
    factoryLogLine("Run failed: " + e.message, "chain_error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "▶ Run the chain"; }
    factoryLoadHistory();
  }
}

function factoryRenderResults(pkg) {
  if (!pkg) return;
  const card = document.getElementById("factoryResultsCard");
  if (card) card.classList.remove("hidden");
  const scoreEl = document.getElementById("factoryOverallScore");
  if (scoreEl) {
    const s = pkg.overallScore || 0;
    scoreEl.textContent = s + "/100";
    scoreEl.style.color = s >= 70 ? "#10b981" : s >= 40 ? "#f59e0b" : "#ef4444";
  }
  const meta = document.getElementById("factoryResultMeta");
  if (meta) meta.textContent = "Ran in " + (pkg.totalDurationMs/1000).toFixed(1) + "s on " + new Date(pkg.startedAt).toLocaleString();

  const personaEl = document.getElementById("factoryResultPersona");
  if (personaEl && pkg.audience && pkg.audience.persona) {
    const p = pkg.audience.persona;
    personaEl.innerHTML = '<h5>' + factoryEscapeHtml(p.name || "Persona") + ', ' + (p.age || "") + ' (' + factoryEscapeHtml(p.occupation || "") + ')</h5>' +
      '<p><strong>Key quote:</strong> <em>"' + factoryEscapeHtml(p.keyQuote || "") + '"</em></p>' +
      '<p><strong>Pain points:</strong> ' + (p.painPoints || []).map(factoryEscapeHtml).join("; ") + '</p>' +
      '<p><strong>Preferred channels:</strong> ' + (p.preferredChannels || []).map(factoryEscapeHtml).join(", ") + '</p>' +
      '<p><strong>Willingness to pay:</strong> ₹' + (p.willingnessToPay || "—") + ' | <strong>Frequency:</strong> ' + (p.frequencyPerWeek || "—") + '/week</p>' +
      '<p class="note">Provider: ' + (p.llmProvider || "fallback") + (p.llmModel ? " (" + p.llmModel + ")" : "") + '</p>';
  }

  const perfEl = document.getElementById("factoryResultPerformance");
  if (perfEl && pkg.channel && pkg.channel.performance && pkg.channel.performance.predicted) {
    const p = pkg.channel.performance.predicted;
    const plan = pkg.channel.performance.channelPlan || [];
    perfEl.innerHTML = '<p><strong>Predicted orders:</strong> ' + p.orders + ' | <strong>Revenue:</strong> ₹' + (p.revenue || 0).toLocaleString() + '</p>' +
      '<p><strong>ROAS:</strong> ' + p.roas + 'x | <strong>CPA:</strong> ₹' + p.cpa + ' | <strong>Avg CTR:</strong> ' + (p.ctr*100).toFixed(2) + '%</p>' +
      '<h5>Channel mix</h5><ul>' + plan.map(c => '<li><strong>' + factoryEscapeHtml(c.channel) + '</strong> — ₹' + (c.spend || 0).toLocaleString() + ' (' + c.share + '%) → ' + c.orders + ' orders</li>').join("") + '</ul>';
  }

  const variantsEl = document.getElementById("factoryResultVariants");
  if (variantsEl && Array.isArray(pkg.copy && pkg.copy.variants)) {
    variantsEl.innerHTML = pkg.copy.variants.map(v =>
      '<div class="variant-card">' +
        '<div class="v-channel">' + factoryEscapeHtml(v.channel || "whatsapp") + ' · ' + factoryEscapeHtml(v.tone || "") + ' · CTR: ' + factoryEscapeHtml(v.estimatedCtrBand || "—") + '</div>' +
        '<div class="v-hook">' + factoryEscapeHtml(v.hook || "") + '</div>' +
        '<div class="v-body">' + factoryEscapeHtml(v.body || "") + '</div>' +
        '<div class="v-cta">' + factoryEscapeHtml(v.cta || "") + '</div>' +
        (v.translation_en ? '<div class="v-body" style="color:#888;font-style:italic;">' + factoryEscapeHtml(v.translation_en) + '</div>' : "") +
        '<div class="v-rationale">' + factoryEscapeHtml(v.rationale || "") + '</div>' +
      '</div>'
    ).join("") || '<p class="note">No variants generated (LLM unavailable).</p>';
  }

  const planEl = document.getElementById("factoryResultPlan");
  if (planEl && pkg.channel && pkg.channel.plan) {
    const wp = pkg.channel.plan.weeklyPlan || [];
    const kpis = pkg.channel.plan.kpis || [];
    const cn = pkg.channel.plan.complianceNotes || [];
    planEl.innerHTML = '<h5>7-day plan</h5><ul>' + wp.map(d =>
      '<li><strong>' + factoryEscapeHtml(d.day || "") + '</strong> — ' + factoryEscapeHtml(d.channel || "") + ': ' + factoryEscapeHtml(d.action || "") + ' (₹' + (d.budget || 0) + ') → ' + factoryEscapeHtml(d.expectedOutcome || "") + '</li>'
    ).join("") + '</ul>' +
    '<h5>KPIs</h5><ul>' + kpis.map(k =>
      '<li>' + factoryEscapeHtml(k.name || "") + ': ' + factoryEscapeHtml(String(k.target || "")) + ' <em>(' + factoryEscapeHtml(k.rationale || "") + ')</em></li>'
    ).join("") + '</ul>' +
    (cn.length ? '<h5>Compliance notes</h5><ul>' + cn.map(n => '<li>' + factoryEscapeHtml(n) + '</li>').join("") + '</ul>' : "");
  }

  const compEl = document.getElementById("factoryResultCompliance");
  if (compEl && pkg.compliance) {
    const c = pkg.compliance;
    const verdict = c.overallVerdict || "unknown";
    const color = verdict === "pass" ? "#10b981" : verdict === "block" ? "#ef4444" : "#f59e0b";
    const pattern = c.patternFindings || [];
    const llmFindings = (c.llmAudit && c.llmAudit.findings) || [];
    compEl.innerHTML = '<p><strong>Verdict:</strong> <span style="color:' + color + ';text-transform:uppercase;font-weight:700;">' + factoryEscapeHtml(verdict) + '</span> · <strong>Risk score:</strong> ' + (c.riskScore || 0) + '/100</p>' +
      (c.requiredDisclaimers && c.requiredDisclaimers.length ? '<p><strong>Required disclaimers:</strong> ' + c.requiredDisclaimers.map(factoryEscapeHtml).join("; ") + '</p>' : "") +
      (pattern.length ? '<h5>Pattern findings (' + pattern.length + ')</h5><ul>' + pattern.map(f =>
        '<li><strong>' + factoryEscapeHtml(f.severity) + '</strong> [' + factoryEscapeHtml(f.variantId) + '] — ' + factoryEscapeHtml(f.issue) + ' <em>(' + factoryEscapeHtml(f.recommendation) + ')</em></li>'
      ).join("") + '</ul>' : "") +
      (llmFindings.length ? '<h5>LLM audit findings (' + llmFindings.length + ')</h5><ul>' + llmFindings.map(f =>
        '<li><strong>' + factoryEscapeHtml(f.severity || "—") + '</strong> [' + factoryEscapeHtml(f.variantId || "—") + '] — ' + factoryEscapeHtml(f.issue || "") + ' <em>' + factoryEscapeHtml(f.recommendation || "") + '</em></li>'
      ).join("") + '</ul>' : "");
  }
}

async function factoryRefreshResearch() {
  const brand = document.getElementById("factoryBrand")?.value;
  const city = document.getElementById("factoryCity")?.value;
  const meta = document.getElementById("factoryResearchMeta");
  const feed = document.getElementById("factoryResearchFeed");
  if (!feed) return;
  if (meta) meta.textContent = "Loading...";
  feed.innerHTML = '<p class="note">Running Research agent (Tavily + Google News RSS + LLM)...</p>';
  try {
    const r = await fetch("/api/research/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: brand, city: city, force: true })
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    factoryRenderResearch(j);
    if (meta) meta.textContent = (j.sources || 0) + " sources, " + (j.durationMs/1000).toFixed(1) + "s";
  } catch (e) {
    if (meta) meta.textContent = "Error: " + e.message;
    feed.innerHTML = '<p class="note">Failed: ' + factoryEscapeHtml(e.message) + '</p>';
  }
}

function factoryRenderResearch(j) {
  const feed = document.getElementById("factoryResearchFeed");
  if (!feed) return;
  const summary = j.summary;
  let html = "";
  if (summary && summary.summary) {
    html += '<div class="research-item"><h5>📊 LLM summary</h5><p>' + factoryEscapeHtml(summary.summary) + '</p>' +
      (summary.competitiveImplications ? '<p><em>' + factoryEscapeHtml(summary.competitiveImplications) + '</em></p>' : "") + '</div>';
  }
  const developments = (summary && summary.keyDevelopments) || [];
  for (const d of developments.slice(0, 8)) {
    html += '<div class="research-item"><h5>' + factoryEscapeHtml(d.headline || "") + '</h5>' +
      '<p>' + factoryEscapeHtml(d.whyItMatters || "") + '</p>' +
      (d.citation ? '<p><a href="' + factoryEscapeHtml(d.citation) + '" target="_blank" rel="noopener">' + factoryEscapeHtml(d.citation) + '</a></p>' : "") +
      (d.sentiment ? '<span class="sentiment ' + factoryEscapeHtml(d.sentiment) + '">' + factoryEscapeHtml(d.sentiment) + '</span>' : "") +
      '</div>';
  }
  if (!html) html = '<p class="note">No research data. Configure TAVILY_API_KEY for live intelligence.</p>';
  feed.innerHTML = html;
}

async function factoryGenerateBrief() {
  const meta = document.getElementById("factoryBriefMeta");
  const out = document.getElementById("factoryBriefOutput");
  if (!out) return;
  if (meta) meta.textContent = "Generating brief...";
  out.innerHTML = '<p class="note">Running Copy agent (LLM call)...</p>';
  try {
    const brand = document.getElementById("factoryBrand")?.value;
    const city = document.getElementById("factoryCity")?.value;
    const category = document.getElementById("factoryCategory")?.value;
    const language = document.getElementById("factoryLanguage")?.value;
    const r = await fetch("/api/brief/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: brand, city: city, category: category, language: language })
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const brief = j.brief;
    if (!brief) { out.innerHTML = '<p class="note">No brief returned (LLM unavailable).</p>'; return; }
    out.innerHTML = '<div class="brief-title">' + factoryEscapeHtml(brief.title || "") + '</div>' +
      '<div class="brief-tagline">"' + factoryEscapeHtml(brief.tagline || "") + '"' + (brief.taglineAlt ? ' — ' + factoryEscapeHtml(brief.taglineAlt) : "") + '</div>' +
      '<div class="brief-section"><h5>Concept</h5><p>' + factoryEscapeHtml(brief.concept || "") + '</p></div>' +
      '<div class="brief-section"><h5>Key message</h5><p>' + factoryEscapeHtml(brief.keyMessage || "") + '</p></div>' +
      '<div class="brief-section"><h5>Tone</h5><p>' + factoryEscapeHtml(brief.tone || "") + '</p></div>' +
      '<div class="brief-section"><h5>Deliverables</h5><ul>' + (brief.deliverables || []).map(d =>
        '<li><strong>' + factoryEscapeHtml(d.type || "") + '</strong> — ' + factoryEscapeHtml(d.spec || "") + ' <em>' + factoryEscapeHtml(d.outline || "") + '</em></li>'
      ).join("") + '</ul></div>' +
      '<div class="brief-section"><h5>Do</h5><ul>' + (brief.doList || []).map(d => '<li>' + factoryEscapeHtml(d) + '</li>').join("") + '</ul></div>' +
      '<div class="brief-section"><h5>Don&#39;t</h5><ul>' + (brief.dontList || []).map(d => '<li>' + factoryEscapeHtml(d) + '</li>').join("") + '</ul></div>' +
      '<p class="note">Provider: ' + (j.provider || "fallback") + (j.model ? " (" + j.model + ")" : "") + '</p>';
    if (meta) meta.textContent = "Done in " + (j.durationMs/1000).toFixed(1) + "s";
  } catch (e) {
    if (meta) meta.textContent = "Error: " + e.message;
    out.innerHTML = '<p class="note">Failed: ' + factoryEscapeHtml(e.message) + '</p>';
  }
}

async function factoryLoadHistory() {
  try {
    const r = await fetch("/api/campaign/history");
    const j = await r.json();
    factoryState.history = j.history || [];
    renderFactoryHistory();
  } catch {}
}

function renderFactoryHistory() {
  const list = document.getElementById("factoryHistoryList");
  if (!list) return;
  if (!factoryState.history.length) { list.innerHTML = '<p class="note">No runs yet.</p>'; return; }
  list.innerHTML = factoryState.history.map(h =>
    '<div class="history-row"><span>' + new Date(h.startedAt).toLocaleString() + ' — ' +
    factoryEscapeHtml(h.input?.brand || "") + '/' + factoryEscapeHtml(h.input?.city || "") + ' (' +
    (h.totalDurationMs/1000).toFixed(1) + 's)</span><span class="score">' + (h.overallScore || 0) + '/100</span></div>'
  ).join("");
}

function factoryEscapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function factoryInit() {
  factoryCheckLLMStatus();
  factoryConnectSSE();
  factoryLoadHistory();

  document.getElementById("factoryRunBtn")?.addEventListener("click", factoryRunChain);
  document.getElementById("factoryRefreshResearch")?.addEventListener("click", factoryRefreshResearch);
  document.getElementById("factoryGenerateBrief")?.addEventListener("click", factoryGenerateBrief);
  document.getElementById("factoryHistoryBtn")?.addEventListener("click", () => {
    const p = document.getElementById("factoryHistoryPanel");
    if (p) p.classList.toggle("hidden");
  });
  document.getElementById("factorySseToggle")?.addEventListener("click", (e) => {
    factoryState.sseOn = !factoryState.sseOn;
    e.target.textContent = "Live stream: " + (factoryState.sseOn ? "ON" : "OFF");
    if (factoryState.sseOn) factoryConnectSSE();
    else if (factoryState.sse) { try { factoryState.sse.close(); } catch {} factoryState.sse = null; }
  });
  document.getElementById("factoryClearResults")?.addEventListener("click", () => {
    const card = document.getElementById("factoryResultsCard");
    if (card) card.classList.add("hidden");
    factoryState.lastResult = null;
  });
  document.getElementById("factoryExportJson")?.addEventListener("click", () => {
    if (!factoryState.lastResult) return;
    const blob = new Blob([JSON.stringify(factoryState.lastResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "campaign-" + factoryState.lastResult.chainId + ".json";
    a.click();
    URL.revokeObjectURL(url);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", factoryInit);
} else {
  factoryInit();
}
