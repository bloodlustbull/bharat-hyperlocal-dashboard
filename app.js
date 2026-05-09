/*
  app.js is the dashboard brain.
  It loads local JSON files, applies platform themes, draws charts, and generates plans/reports.
*/

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
let marketSignals = null;

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

let bmSelectedBrand = null;

function getSelectedBenchmark() {
  return bmSelectedBrand;
}

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
    generateBrief();
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

function selectedTheme() {
  return PLATFORM_THEMES[selectedPlatform()?.id] || PLATFORM_THEMES.blinkit;
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

function applyTheme(platformId) {
  updateTheme(platformId);
}

function setActivePlatform(platformId) {
  if ($("platformSelect")) $("platformSelect").value = platformId;
  ["scorerPlatformSelect", "plannerPlatformSelect", "reportPlatformSelect"].forEach(id => {
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
  ["platformSelect", "scorerPlatformSelect", "plannerPlatformSelect", "reportPlatformSelect"].forEach(id => {
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
  ["citySelect", "plannerCitySelect", "reportCitySelect"].forEach(id => { if ($(id)) $(id).innerHTML = cityOptions; });
  ["categorySelect", "plannerCategorySelect", "reportCategorySelect"].forEach(id => { if ($(id)) $(id).innerHTML = categoryOptions; });
  updateLanguageOptions("citySelect", "languageSelect");
  updateLanguageOptions("plannerCitySelect", "plannerLanguageSelect");
  updateLanguageOptions("reportCitySelect", "reportLanguageSelect");
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

  rows.push({ name: "Public market data", status: hasSources && hasMetrics ? "loaded" : "partial" });
  rows.push({ name: "City-language seed data", status: hasCities ? "loaded" : "partial" });
  rows.push({ name: "Platform intelligence", status: hasPlatformIntel ? "loaded" : "partial" });
  rows.push({ name: "Campaign CSV", status: caCsvData ? "loaded" : "not-connected" });
  rows.push({ name: "News / live market feed", status: "not-connected" });
  rows.push({ name: "Google Trends / search demand", status: "not-connected" });
  return rows;
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

function renderOeSignals() {
  const signals = oeSignals();
  $("oeSignals").innerHTML = signals.map(s => {
    const cls = s.status === "loaded" ? "loaded" : s.status === "partial" ? "partial" : "not-connected";
    const label = s.status === "loaded" ? "Loaded" : s.status === "partial" ? "Partial" : "Not connected";
    return `<div class="oe-signal-row"><span class="oe-signal-name">${escapeHtml(s.name)}</span><span class="oe-signal-status ${cls}">${label}</span></div>`;
  }).join("");
}

function generateBrief() {
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

async function copyBrief() {
  if (!window._oeBriefData) { generateBrief(); }
  const text = window._oeBriefData.fields.map(f => `${f.label}: ${f.value}`).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    $("oeCopyBrief").textContent = "Copied!";
    setTimeout(() => { $("oeCopyBrief").textContent = "Copy brief"; }, 2000);
  } catch(e) { console.warn("Clipboard write failed", e); }
}

function exportJson() {
  if (!window._oeBriefData) { generateBrief(); }
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

function generateCampaignDraft() {
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

  let primary, short, cta, followup, reminder, unsubscribe;

  if (obj === "Awareness") {
    primary = `${cat.charAt(0).toUpperCase() + cat.slice(1)} delivery is now live in ${cityName}. Explore available options near you.`;
    short = `${cat.charAt(0).toUpperCase() + cat.slice(1)} in ${cityName} — tap to explore.`;
    cta = "Explore now";
    followup = `Still looking for ${cat} options in ${cityName}? Here are this week's picks.`;
    reminder = `Your ${cat} delivery is available in ${cityName}. Open the app to browse.`;
  } else if (obj === "Trial" || obj === "Conversion") {
    primary = `Need ${cat} fast in ${cityName}? Try a quick local convenience run today. ${offer !== "No discount" ? offer + " for first orders." : ""}`.trim();
    short = `${cat.charAt(0).toUpperCase() + cat.slice(1)} in ${cityName} — first order offer inside.`;
    cta = "Order now";
    followup = `Your ${cat} order is a tap away. ${offer !== "No discount" ? offer + " still available." : "Fast delivery in your area."}`;
    reminder = `${cat.charAt(0).toUpperCase() + cat.slice(1)} delivery reminder — your offer expires soon.`;
  } else if (obj === "Retention" || obj === "Repeat purchase") {
    primary = `Welcome back. Your regular ${cat} order is ready to reorder in one tap.`;
    short = `Reorder your ${cat} essentials in ${cityName}.`;
    cta = "Reorder now";
    followup = `Haven't ordered ${cat} this week? Your usual items are in stock.`;
    reminder = `Your ${cat} replenishment window is open. Tap to reorder.`;
  } else if (obj === "Win-back") {
    primary = `It's been a while. Your ${cat} delivery in ${cityName} is still here — come back with a fresh offer.`;
    short = `We miss you — ${cat} delivery in ${cityName}, with a comeback offer.`;
    cta = "Come back";
    followup = `Your local ${cat} selection has expanded. Browse what's new in ${cityName}.`;
    reminder = `Last chance — your win-back offer for ${cat} delivery expires today.`;
  } else {
    primary = `${cat.charAt(0).toUpperCase() + cat.slice(1)} delivery in ${cityName} — explore what's available near you.`;
    short = `${cat} delivery in ${cityName} — tap to explore.`;
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
    { label: "Unsubscribe line", value: unsubscribe }
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

  window._oeBriefData = window._oeBriefData || null;
}

async function copyCampaignDraft() {
  if (!caDraftData) { generateCampaignDraft(); }
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
    setTimeout(() => { $("caCopyDraft").textContent = "Copy draft"; }, 2000);
  } catch(e) { console.warn("Clipboard write failed", e); }
}

function caAddToBrief() {
  if (!caDraftData) { generateCampaignDraft(); }
  if (!caDraftData) return;
  if (!window._oeBriefData) { generateBrief(); }
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
  if (!caDraftData) { generateCampaignDraft(); }
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

function selectedMulti(id) {
  return Array.from($(id).selectedOptions).map(option => option.value);
}

function renderExperimentPlan() {
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

function primaryKpi(objective) {
  if (objective.includes("Awareness")) return "CTR and reach";
  if (objective.includes("Repeat")) return "Repeat order rate";
  if (objective.includes("WhatsApp")) return "WhatsApp reply rate and CTR";
  if (objective.includes("Society")) return "Society penetration and first orders";
  return "CVR, CAC, first orders";
}

function renderUnitEconomics() {
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

function renderReport() {
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
  [["citySelect", "languageSelect"], ["plannerCitySelect", "plannerLanguageSelect"], ["reportCitySelect", "reportLanguageSelect"]].forEach(([cityId, langId]) => $(cityId).addEventListener("change", () => { updateLanguageOptions(cityId, langId); renderScore(); renderExperimentPlan(); renderReport(); renderCampaignAutopilot(); renderBenchmarkCockpit(); }));
  ["languageSelect", "categorySelect", "scorerPlatformSelect", "objectiveSelect"].forEach(id => $(id).addEventListener("change", () => { renderScore(); renderCampaignAutopilot(); renderBenchmarkCockpit(); }));
  $("channelSelect")?.addEventListener("change", () => { renderScore(); });
  $("oeGenerateBrief").addEventListener("click", generateBrief);
  $("oeCopyBrief").addEventListener("click", copyBrief);
  $("oeExportJson").addEventListener("click", exportJson);
  $("oeMarkValidation").addEventListener("click", markValidation);
  $("oeExplainToggle").addEventListener("click", () => { toggleExplain(); if (!$("oeExplainPanel").classList.contains("hidden")) renderExplainPanel(); });
  ["caObjective", "caChannel", "caOffer", "caTone"].forEach(id => { const el = $(id); if (el) el.addEventListener("change", renderCampaignAutopilot); });
  $("caGenerateDraft").addEventListener("click", generateCampaignDraft);
  $("caCopyDraft").addEventListener("click", copyCampaignDraft);
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
  ["plannerPlatformSelect", "plannerLanguageSelect", "plannerCategorySelect", "plannerObjectiveSelect", "plannerBudgetSelect", "plannerDurationSelect", "plannerOfferSelect", "plannerChannelSelect"].forEach(id => $(id).addEventListener("change", renderExperimentPlan));
  $("generateExperimentPlan").addEventListener("click", renderExperimentPlan);
  ["unitAovInput", "unitMarginInput", "unitRepeatInput", "unitCacInput", "unitLifetimeInput"].forEach(id => $(id).addEventListener("input", renderUnitEconomics));
  ["reportPlatformSelect", "reportLanguageSelect", "reportCategorySelect", "reportObjectiveSelect", "offerInput", "toneSelect", "channelMixSelect", "reportNotesInput"].forEach(id => $(id).addEventListener("change", renderReport));
  $("reportNotesInput").addEventListener("input", renderReport);
  $("generateReport").addEventListener("click", renderReport);
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
}

async function init() {
  marketData = await loadJson("data/public_market_data.json", FALLBACK_MARKET_DATA);
  seedData = await loadJson("data/city_language_seed.json", FALLBACK_SEED_DATA);
  populatePlatformControls();
  populateSeedControls();
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
  renderExperimentPlan();
  renderUnitEconomics();
  renderReport();
  renderOeSignals();
  renderBenchmarkCockpit();
  attachEvents();
  if ($("three-overlay") && !$("three-overlay").classList.contains("hidden")) {
    setView(null);
  } else {
    showLanding();
  }
  await loadMarketSignals();
}

window.enterDashboard = enterDashboard;
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
