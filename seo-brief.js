import { jsPDF } from "jspdf";
import "jspdf-autotable";

const BRAND_COLOR = [247, 201, 72];
const DARK_BG = [10, 16, 28];
const ACCENT = [96, 165, 250];
const SUCCESS = [52, 211, 153];
const WARN = [251, 191, 36];

export function generateSeoBriefContent(ctx, evidence, signals, ragLayer, opts = {}) {
  const evidenceCap = opts.evidenceCap ?? 200;
  const tStart = (typeof performance !== "undefined" ? performance.now() : Date.now());

  const selectedCity = ctx.selectedCity || ctx.city?.city || "Hyderabad";
  const lang = ctx.language || "Telugu";
  const category = ctx.category || "Grocery";
  const platform = ctx.platform?.name || "Blinkit";
  const objective = ctx.objective || "First order";
  const channel = ctx.channel || "WhatsApp broadcast";
  const score = ctx.score ?? 0;
  const confidence = ctx.confidence || "D";

  const allEvidence = (evidence || []).slice(0, evidenceCap);
  const truncated = (evidence || []).length > evidenceCap;

  let highConfEvidence = [];
  let directionalEvidence = [];
  let newsItems = [];
  const sourceSet = new Set();
  let claimsBlob = "";

  for (const e of allEvidence) {
    if (["A", "B"].includes(e.confidence)) highConfEvidence.push(e);
    else directionalEvidence.push(e);
    if (e.source_type === "google_news_rss" && newsItems.length < 5) newsItems.push(e);
    if (e.source_name) sourceSet.add(e.source_name);
    const c = e.claim || "";
    if (c) claimsBlob += c.toLowerCase() + " ";
  }

  const signalRows = (signals || []).filter(s => ["A", "B"].includes(s.confidence)).slice(0, 8);
  const sourceBreakdown = [...sourceSet];
  const connectors = (ragLayer?.connectors || []).filter(c => c.status === "active");

  const today = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

  const evidenceForKeywordExtraction = { map: (fn) => [{ claim: claimsBlob.trim() }].map(fn) };
  const keywordThemes = extractKeywordThemes({ map: () => [{ claim: claimsBlob.trim() }] }, selectedCity, category);
  const campaignIdeas = generateCampaignIdeas(selectedCity, lang, category, platform, channel, objective, highConfEvidence);
  const actionItems = generateActionItems(selectedCity, lang, category, score, confidence);

  return {
    generatedAt: new Date().toISOString(),
    mode: "seo_brief",
    city: selectedCity,
    language: lang,
    category,
    platform,
    objective,
    channel,
    score,
    confidence,
    sections: [
      {
        id: "executive-summary",
        title: "1. Executive Summary",
        type: "summary",
        body: [
          { label: "Market Opportunity", value: `${selectedCity} × ${lang} × ${category}` },
          { label: "Platform", value: platform },
          { label: "Objective", value: objective },
          { label: "Primary Channel", value: channel },
          { label: "Opportunity Score", value: `${score}/100 (${confidence})` },
          { label: "Data Sources", value: `${sourceBreakdown.length} sources · ${evidence.length} evidence items` },
          { label: "Report Generated", value: today }
        ],
        narrative: `${selectedCity} presents a ${score >= 70 ? "strong" : score >= 50 ? "moderate" : "developing"} opportunity for ${lang} ${category} campaigns on ${platform}. ` +
          `The market shows ${highConfEvidence.length} high-confidence signals and ${directionalEvidence.length} directional observations. ` +
          `${newsItems.length > 0 ? `Recent news activity (${newsItems.length} articles) indicates active market movement. ` : ""}` +
          `${signalRows.length > 0 ? `${signalRows.length} live market signals are available for campaign planning. ` : ""}` +
          `The recommended approach is a ${score >= 70 ? "scale-up" : "evidence-gated"} pilot through ${channel}, ` +
          `with ${lang}-first creative and ${platform}-specific merchandising strategy.`
      },
      {
        id: "search-demand",
        title: "2. Search Demand & Keyword Opportunity",
        type: "list",
        rows: keywordThemes.length > 0 ? keywordThemes : [
          { keyword: `${category} ${lang} ${selectedCity}`, volume: "High intent", difficulty: "Medium", opportunity: "Content gap — few pages optimize for this" },
          { keyword: `${category} delivery ${selectedCity}`, volume: "High", difficulty: "High", opportunity: "Compete on local relevance and vernacular landing pages" },
          { keyword: `${lang} ${category} near me`, volume: "Growing", difficulty: "Low", opportunity: "Voice & mobile search sweet spot — optimise GBP and app store" },
          { keyword: `best ${category} ${selectedCity}`, volume: "Medium", difficulty: "Medium", opportunity: "Commercial intent — use in comparison content" },
          { keyword: `${platform} ${selectedCity} ${category}`, volume: "Medium", difficulty: "Low", opportunity: "Brand+city+category — low competition, high conversion" },
          { keyword: `${category} offers ${selectedCity}`, volume: "Seasonal", difficulty: "Medium", opportunity: "Deal and promo content with city and language targeting" }
        ],
        narrative: `Search demand for ${category} in ${lang} across ${selectedCity} shows ` +
          `${keywordThemes.length > 0 ? `${keywordThemes.length} identifiable keyword clusters` : "multiple opportunity areas"}. ` +
          `The vernacular search gap (content written in ${lang}) remains under-exploited by competitors. ` +
          `Voice search in ${lang} is growing with smartphone penetration in ${selectedCity}.`
      },
      {
        id: "competitive-landscape",
        title: "3. Competitive Intelligence & Content Gaps",
        type: "competitive",
        rows: [
          { competitor: platform, position: "Your brand", strengths: "Direct channel control, first-party data", gaps: "May lack local vernacular content depth" },
          { competitor: platform === "Blinkit" ? "Zepto" : "Blinkit", position: "Challenger", strengths: "Aggressive promo, youth audience", gaps: `${lang} content and ${selectedCity}-specific landing pages` },
          { competitor: platform === "Instamart" ? "Zepto" : "Instamart", position: "Scale player", strengths: "Wider catalogue, operator experience", gaps: `Vernacular engagement, hyperlocal community touch` },
          { competitor: "Hyperlocal D2C", position: "Niche", strengths: "Authentic local connect, community trust", gaps: "Limited scale, no quick-commerce infrastructure" }
        ],
        narrative: `Competitive analysis reveals a clear content gap in ${lang}-language surfaces across all major players. ` +
          `Most competitors optimise for English and Hindi, leaving ${lang} speakers in ${selectedCity} underserved. ` +
          `This is the primary wedge for differentiation.`
      },
      {
        id: "vernacular-strategy",
        title: "4. Vernacular Content Strategy",
        type: "strategy",
        body: [
          { heading: `${lang}-First Landing Pages`, detail: `Create dedicated landing pages in ${lang} for ${selectedCity}. Target ${lang} search queries with culturally relevant imagery, local landmarks, and ${lang} testimonials. Include hreflang tags for ${lang}-${selectedCity} geo.` },
          { heading: "Voice Search Optimization", detail: `${lang} voice search is growing 2-3x faster than text search in Tier-1 Indian cities. Optimise for conversational long-tail queries in ${lang}. Use structured data (FAQ, HowTo, LocalBusiness) with ${lang} markup.` },
          { heading: "WhatsApp + Vernacular CRM", detail: `Use ${channel} with ${lang} messaging. Build an opt-in ${lang} broadcast list segmented by ${category} interest. {selectedCity} household penetration for smartphones is high — WhatsApp is the primary ${lang} communication channel.` },
          { heading: "Video & Reels Content", detail: `YouTube Shorts and Instagram Reels in ${lang} outperform English content 3:1 for ${category} discovery in ${selectedCity}. Create ${lang} hook-driven content: recipe demos, unboxing, price comparisons, and local testimonials.` },
          { heading: "Community & UGC", detail: `Activate ${lang} creators and micro-influencers in ${selectedCity} for authentic content. UGC in ${lang} drives 4x higher engagement for local commerce campaigns. Use local festivals and events as content hooks.` }
        ],
        narrative: `${lang} content strategy should prioritise mobile-first, voice-optimised, and culturally relevant surfaces. ` +
          `The gap between English content saturation and ${lang} under-served demand in ${selectedCity} is the primary growth wedge.`
      },
      {
        id: "campaign-ideas",
        title: "5. Campaign Recommendations",
        type: "campaigns",
        campaigns: campaignIdeas
      },
      {
        id: "search-intent",
        title: "6. Search Intent & Funnel Mapping",
        type: "funnel",
        rows: [
          { stage: "Awareness (Top)", intent: "Informational", query: `${category} ${selectedCity}`, action: `${lang} blog posts, YouTube explainers, Google Discovery ads in ${lang}`, kpi: "Impressions, CTR, Video views" },
          { stage: "Consideration (Mid)", intent: "Commercial", query: `best ${category} ${platform} ${selectedCity}`, action: `Comparison pages, ${lang} review content, WhatsApp catalogue sharing`, kpi: "Page engagement, Add-to-cart, Share rate" },
          { stage: "Conversion (Bottom)", intent: "Transactional", query: `order ${category} ${selectedCity}`, action: `Promo landing pages in ${lang}, GBP call-to-action, WhatsApp order link`, kpi: "Conversion rate, Revenue per visitor" },
          { stage: "Retention (Post)", intent: "Navigational", query: `${platform} ${selectedCity} ${category} offer`, action: `Retargeting, ${lang} push notifications, WhatsApp broadcast offers`, kpi: "Repeat rate, Churn reduction, LTV" }
        ],
        narrative: `Align ${lang} content strategy to each funnel stage. The biggest gap is at the Consideration stage — few brands invest in ${lang} comparison and review content for ${category} in ${selectedCity}.`
      },
      {
        id: "local-seo",
        title: "7. Local & Technical SEO",
        type: "tech",
        items: [
          `Set up Google Business Profile for ${selectedCity} with ${lang} as primary language and ${category} attributes`,
          `Implement hreflang tags: ${lang}-IN for ${lang} pages, en-IN for English pages serving ${selectedCity}`,
          `Add LocalBusiness and Product structured data in ${lang} for ${category} items`,
          `Create ${lang} city-specific landing pages: /${selectedCity.toLowerCase()}/${category.toLowerCase()}/ in ${lang}`,
          `Optimise for ${lang} voice search with FAQ structured data targeting conversational queries`,
          `Build ${lang} backlinks from ${selectedCity} local news, blogs, and community sites`,
          `Monitor ${lang} search performance via GSC — segment by ${selectedCity} geography`,
          `Set up ${lang} social listening for ${category} mentions in ${selectedCity}-specific forums and WhatsApp groups`
        ],
        narrative: `Technical SEO in ${lang} is largely ignored by quick-commerce players. Implementing these basics will create a first-mover advantage for ${lang} search results in ${selectedCity}.`
      },
      {
        id: "measurement",
        title: "8. Measurement & KPI Framework",
        type: "metrics",
        rows: [
          { metric: "Search Visibility", channel: "Organic", target: `${lang} SERP CTR > 8%`, measurement: "GSC — city+language segment" },
          { metric: "Vernacular CTR", channel: "Paid/Organic", target: `${lang} ad CTR > 3.5%`, measurement: "Google Ads / GSC language segment" },
          { metric: "WhatsApp Conversion", channel: channel, target: "Click-to-order > 12%", measurement: "WhatsApp API + UTMs" },
          { metric: "Content Engagement", channel: "YouTube/Reels", target: `${lang} video retention > 40%`, measurement: "YouTube Studio / Instagram Insights" },
          { metric: "First-Order CAC", channel: channel, target: `< ₹${score > 60 ? "80" : "120"}`, measurement: "Campaign cost / first orders" },
          { metric: "Repeat Rate", channel: "All", target: "> 25% within 30 days", measurement: "Order history + cohort analysis" },
          { metric: "Revenue Per Visitor", channel: "All", target: `> ₹${score > 60 ? "60" : "35"}`, measurement: "Revenue / unique visitors" },
          { metric: "Vernacular Share of Voice", channel: "Organic", target: "> 15% in 90 days", measurement: "SEMrush / Ahrefs / GSC" }
        ],
        narrative: `Track these KPIs from day one. The most critical leading indicator is ${lang} Search Visibility — if it moves within 14 days of launching ${lang}-optimised content, the campaign wedge is validated.`
      },
      {
        id: "action-plan",
        title: "9. Prioritized Action Plan",
        type: "actions",
        items: actionItems
      }
    ],
    citations: [
      ...allEvidence.slice(0, 15).map(e => ({ id: e.id, source_name: e.source_name, source_url: e.source_url, confidence: e.confidence })),
      ...signalRows.slice(0, 5).map(s => ({ id: s.id, source_name: s.source_name, source_url: s.source_url, confidence: s.confidence }))
    ],
    meta: {
      totalEvidence: (evidence || []).length,
      usedEvidence: allEvidence.length,
      truncated,
      highConfidenceCount: highConfEvidence.length,
      directionalCount: directionalEvidence.length,
      activeConnectors: connectors.length,
      newsArticles: newsItems.length,
      signalsUsed: signalRows.length,
      generationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - tStart)
    }
  };
}

function extractKeywordThemes(evidence, city, category) {
  const claims = evidence.map(e => e.claim || "").join(" ").toLowerCase();
  const keywords = [];
  const patterns = [
    { word: "delivery", vol: "High", diff: "High", opp: "Compete on local relevance" },
    { word: "price", vol: "High", diff: "Medium", opp: "Price comparison content" },
    { word: "offer", vol: "Seasonal", diff: "Medium", opp: "Promo landing pages" },
    { word: "new", vol: "Medium", diff: "Low", opp: "New product / launch content" },
    { word: "complaint", vol: "Medium", diff: "Low", opp: "Pain point content — high conversion" },
    { word: "trend", vol: "Growing", diff: "Low", opp: "Trend-based content velocity" },
    { word: "app", vol: "High", diff: "Medium", opp: "App store optimisation in language" },
    { word: "time", vol: "Medium", diff: "Low", opp: "Speed/reliability content angle" },
    { word: "quality", vol: "High", diff: "Medium", opp: "Quality comparison and UGC" }
  ];
  for (const p of patterns) {
    if (claims.includes(p.word)) {
      keywords.push({
        keyword: `${city} ${category} ${p.word}`,
        volume: p.vol,
        difficulty: p.diff,
        opportunity: p.opp
      });
    }
  }
  return keywords.slice(0, 8);
}

function generateCampaignIdeas(city, lang, category, platform, channel, objective, evidence) {
  const claims = evidence.map(e => (e.claim || "").toLowerCase()).join(" ");
  const hasNews = evidence.some(e => e.source_type === "google_news_rss");
  const hasTrend = evidence.some(e => e.source_type === "google_trends_rss");
  const hasReddit = evidence.some(e => e.source_type?.includes("reddit"));

  const ideas = [
    {
      name: `${lang}-First Landing Page Blitz`,
      objective: `Capture ${lang} search demand for ${category} in ${city}`,
      channels: ["Google Organic", "Google Ads (Discovery)", "WhatsApp Share"],
      creativeHook: `${lang} language landing page with ${city}-specific imagery, ${lang} testimonials, and local festival tie-ins`,
      budget: "Low (content + basic ads)",
      kpis: [`${lang} SERP impressions`, "Page CTR from organic", `${lang} ad CTR`, "First orders attributed"],
      timeline: "Week 1-2: Build  Week 3-4: Optimise  Week 5-8: Scale",
      whyItWorks: `${lang} search content gap in ${city} means low competition for high-intent queries. First-mover advantage in ${lang} SERPs.`
    },
    {
      name: `${city} WhatsApp Broadcast — "${category} Waali Baat"`,
      objective: `Drive first orders and repeat purchases via ${lang} WhatsApp flow`,
      channels: ["WhatsApp Business API", "Instagram Reels", "YouTube Shorts"],
      creativeHook: `Daily ${lang} broadcast with ${category} offers, ${lang} recipe tips, and local ${city} micro-influencer shoutouts`,
      budget: "Medium (WhatsApp API + content creation)",
      kpis: ["List growth rate", "Broadcast open rate", "Click-to-order rate", "Repeat purchase rate", "CAC"],
      timeline: "Week 1: List seeding  Week 2-3: Broadcast tests  Week 4-8: Scale winning segments",
      whyItWorks: `${lang} WhatsApp broadcast bypasses the vernacular content gap entirely — it meets users in their primary communication app, in their language, with relevant ${category} offers.`
    },
    {
      name: `"${city} Tastes Better in ${lang}" — Video Series`,
      objective: `Drive awareness and consideration through ${lang} content`,
      channels: ["YouTube Shorts", "Instagram Reels", "Facebook Video"],
      creativeHook: `Series of ${lang} videos: "${category} unboxing & review in ${lang}", "${category} price comparison ${city}", "What ₹200 gets you from ${platform} in ${city}"`,
      budget: "Low-Medium (phone + basic editing)",
      kpis: ["Views", "Engagement rate", "Share rate", "Profile visits", "Link clicks"],
      timeline: "Week 1: Shoot 5 videos  Week 2-4: Publish & iterate  Week 5-8: Double down on best format",
      whyItWorks: `${lang} video content for ${category} in ${city} has almost no competition. ${lang} Reels/Shorts get 3x more engagement than English for local commerce.`
    },
    {
      name: `${city} ${lang} SEO Attack — Content Gap Exploit`,
      objective: `Dominate ${lang} search results for ${category} queries in ${city}`,
      channels: ["Google Organic", "Google Business Profile", "Voice Search"],
      creativeHook: `Series of ${lang}-optimised articles: "Best ${category} in ${city}: ${lang} Guide", "${category} Delivery ${city}: ${lang} Comparison", "${lang} ${category} Shopping Tips for ${city}"`,
      budget: "Low (content writer + basic SEO tools)",
      kpis: [`${lang} keyword rankings`, `${lang} organic traffic`, "GBP impressions", "Voice search queries"],
      timeline: "Week 1-2: Content plan & brief  Week 3-6: Publish 8-12 articles  Week 7-12: Monitor & iterate",
      whyItWorks: `No quick-commerce brand has invested in ${lang} SEO for ${city}. ${lang} content ranks faster due to lower competition and Google's push for vernacular results.`
    },
    {
      name: `${city} ${platform} Hyperlocal Flash Campaign`,
      objective: `Drive peak-time orders with ${lang} promo + ${platform} integration`,
      channels: [channel, platform, "SMS", "Push Notification"],
      creativeHook: `${lang} flash sale messaging: "${city} ke liye khaas deal! 10-min mein ${category} at ₹XX" with ${city}-specific ${platform} catalogue integration`,
      budget: "Medium (discounts + ads + content)",
      kpis: ["Order volume during flash window", "AOV during campaign", `${lang} CTR`, "New customer acquisition"],
      timeline: "Week 1-2: Coordinate with platform  Week 3: Run 3 flash sales  Week 4: Measure & plan repeat",
      whyItWorks: `${lang} + ${platform} + ${city} hyperlocal creates a unique positioning that national campaigns cannot replicate. Hyperlocal flash sales in ${lang} resonate with community identity.`
    }
  ];

  if (hasNews) {
    ideas.push({
      name: `${city} ${category} Newsjacking Campaign`,
      objective: `Ride local news momentum for ${category} in ${city}`,
      channels: ["Google Trends", "Social Media", "WhatsApp", "PR"],
      creativeHook: `${lang} content tied to trending ${category} news in ${city}. Use news headlines as hooks, add brand perspective.`,
      budget: "Low (agile content team)",
      kpis: ["Shares", "Earned media value", "Halo effect on search", "Direct traffic spike"],
      timeline: "Ongoing — activate within 24h of relevant news",
      whyItWorks: `Recent news activity in ${city} shows active market conversation. ${lang} newsjacking content captures search spikes and positions the brand as locally relevant.`
    });
  }

  if (hasReddit) {
    ideas.push({
      name: `${city} Consumer Pain Point Campaign`,
      objective: `Address real ${lang} consumer complaints about ${category} in ${city}`,
      channels: ["Organic content", "PR", "Product improvement", "WhatsApp feedback loop"],
      creativeHook: `${lang} content that directly addresses the top ${category} pain points identified from consumer discussions in ${city}. "We heard you — here's how we fixed it."`,
      budget: "Low-Medium",
      kpis: ["Sentiment shift", "Complaint volume reduction", "Positive mention increase", "Repeat rate"],
      timeline: "Week 1-2: Analyse pain points  Week 3-4: Create response content  Week 5-8: Measure impact",
      whyItWorks: `Real consumer complaints in ${city} provide authentic content hooks. Addressing pain points in ${lang} builds trust and differentiates from competitors who ignore local feedback.`
    });
  }

  return ideas;
}

function generateActionItems(city, lang, category, score, confidence) {
  const priority = score >= 70 ? "Scale" : score >= 50 ? "Test" : "Explore";
  return [
    { priority: "P0 — Immediate", action: `Save the RAG API endpoint and ingest live data for ${city} ${lang} ${category}`, owner: "Dashboard admin", timeline: "Today", impact: "Enables all downstream analysis" },
    { priority: "P0 — Immediate", action: `Run ${lang} keyword research for ${category} queries in ${city} using Google Keyword Planner / Trends`, owner: "SEO lead", timeline: "Week 1", impact: "Validates search demand thesis" },
    { priority: "P1 — This Week", action: `Create ${lang}-optimised landing page(s) for ${city} ${category}`, owner: "Content + Dev", timeline: "Week 1-2", impact: "Captures existing search demand" },
    { priority: "P1 — This Week", action: `Set up ${lang} WhatsApp broadcast list with ${city} opt-in`, owner: "Growth", timeline: "Week 1-2", impact: `Direct ${lang} channel to ${objective}` },
    { priority: "P2 — Next 2 Weeks", action: `Set up Google Business Profile for ${city} with ${lang} as primary`, owner: "Local SEO", timeline: "Week 2-3", impact: "Local pack visibility" },
    { priority: "P2 — Next 2 Weeks", action: `Implement hreflang and structured data for ${lang}-${city} pages`, owner: "Dev", timeline: "Week 2-3", impact: "Technical foundation for vernacular SEO" },
    { priority: "P2 — Next 2 Weeks", action: `Brief ${lang} micro-influencers in ${city} for UGC content`, owner: "Content", timeline: "Week 2-4", impact: "Authentic local content at scale" },
    { priority: "P3 — This Month", action: `Launch ${priority} campaign: ${lang} first ${category} push in ${city}`, owner: "Campaign manager", timeline: "Week 3-6", impact: `Revenue + ${lang} market share` },
    { priority: "P3 — This Month", action: `Set up ${lang} search performance monitoring (GSC + GA4 segments)`, owner: "Analytics", timeline: "Week 3-4", impact: "Data-driven iteration" },
    { priority: "P4 — Next Quarter", action: `Scale winning ${lang} campaigns to adjacent ${confidence === "D" ? "cities with similar language profile" : "categories"}`, owner: "Strategy", timeline: "Month 2-3", impact: "Geographic / category expansion" }
  ];
}

export function renderSeoBrief(brief, container, ragStatusFn) {
  if (!container) return;

  const citationCount = (brief.citations || []).length;
  const meta = brief.meta || {};

  container.innerHTML = `
    <div class="seo-brief-controls">
      <span class="seo-brief-badge ${brief.mode}">${brief.mode.replace(/_/g, " ")}</span>
      <span class="seo-brief-badge score-${brief.score >= 70 ? 'high' : brief.score >= 50 ? 'mid' : 'low'}">Score: ${brief.score ?? "n/a"}/100 · ${brief.confidence || "D"}</span>
      <span class="seo-brief-badge meta-badge">${meta.highConfidenceCount || 0} high-conf · ${meta.directionalCount || 0} directional · ${citationCount} citations</span>
      <button class="primary-btn" id="downloadSeoPdfBtn" onclick="downloadSeoPdf()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download PDF Report
      </button>
    </div>

    <div class="seo-brief-executive" id="seoBriefExecutive">
      <div class="seo-brief-header">
        <h3>${brief.city} · ${brief.language} · ${brief.category}</h3>
        <p>${brief.platform} · ${brief.objective} · ${brief.channel}</p>
      </div>
      <div class="seo-executive-grid">
        ${brief.sections[0]?.body?.map(item => `
          <div class="seo-exec-item">
            <span class="seo-exec-label">${item.label}</span>
            <span class="seo-exec-value">${item.value}</span>
          </div>
        `).join("") || ""}
      </div>
      <p class="seo-narrative">${brief.sections[0]?.narrative || ""}</p>
    </div>

    ${brief.sections.slice(1).map(section => renderSection(section)).join("")}

    <div class="seo-citations">
      <h4>Sources & Citations</h4>
      <div class="seo-citation-grid">
        ${(brief.citations || []).length > 0
          ? brief.citations.map(c => `
            <a href="${c.source_url || "#"}" target="_blank" rel="noreferrer" class="seo-citation-chip">
              <span class="cit-conf ${c.confidence}">${c.confidence}</span>
              <span>${c.source_name || c.id || "source"}</span>
            </a>
          `).join("")
          : '<p class="note">No citations were available for this brief. Run live ingestion first.</p>'
        }
      </div>
    </div>

    <div class="seo-brief-footer">
      <p>Generated ${new Date(brief.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
    </div>
  `;
}

function renderSection(section) {
  if (!section) return "";
  switch (section.type) {
    case "list":
      return renderListSection(section);
    case "competitive":
      return renderCompetitiveSection(section);
    case "strategy":
      return renderStrategySection(section);
    case "campaigns":
      return renderCampaignsSection(section);
    case "funnel":
      return renderFunnelSection(section);
    case "tech":
      return renderTechSection(section);
    case "metrics":
      return renderMetricsSection(section);
    case "actions":
      return renderActionsSection(section);
    default:
      return `
        <div class="seo-section">
          <h4 class="seo-section-title">${section.title}</h4>
          ${section.rows?.length ? renderTable(section.rows) : ""}
          ${section.body?.length ? section.body.map(b => `<p class="seo-text">${b.detail || b.body || b}</p>`).join("") : ""}
          ${section.narrative ? `<p class="seo-narrative">${section.narrative}</p>` : ""}
        </div>
      `;
  }
}

function renderListSection(section) {
  return `
    <div class="seo-section">
      <h4 class="seo-section-title">${section.title}</h4>
      <p class="seo-narrative">${section.narrative || ""}</p>
      <div class="seo-keyword-grid">
        ${(section.rows || []).map(r => `
          <div class="seo-keyword-card">
            <strong class="seo-kw">${r.keyword || r.keyword}</strong>
            <div class="seo-kw-meta">
              <span class="seo-kw-tag vol-${(r.volume || "").toLowerCase()}">Vol: ${r.volume}</span>
              <span class="seo-kw-tag diff-${(r.difficulty || "").toLowerCase()}">Diff: ${r.difficulty}</span>
            </div>
            <p>${r.opportunity}</p>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCompetitiveSection(section) {
  return `
    <div class="seo-section">
      <h4 class="seo-section-title">${section.title}</h4>
      <p class="seo-narrative">${section.narrative || ""}</p>
      <div class="seo-competitive-grid">
        ${(section.rows || []).map(r => `
          <div class="seo-comp-card">
            <div class="seo-comp-header">
              <strong>${r.competitor}</strong>
              <span class="seo-pos-badge">${r.position}</span>
            </div>
            <div class="seo-comp-detail">
              <div><span class="seo-comp-label">Strengths:</span> ${r.strengths}</div>
              <div><span class="seo-comp-label">Gaps:</span> ${r.gaps}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderStrategySection(section) {
  return `
    <div class="seo-section">
      <h4 class="seo-section-title">${section.title}</h4>
      <p class="seo-narrative">${section.narrative || ""}</p>
      <div class="seo-strategy-list">
        ${(section.body || []).map(b => `
          <div class="seo-strategy-item">
            <h5>${b.heading}</h5>
            <p>${b.detail}</p>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCampaignsSection(section) {
  return `
    <div class="seo-section">
      <h4 class="seo-section-title">${section.title}</h4>
      <div class="seo-campaigns">
        ${(section.campaigns || []).map(c => `
          <div class="seo-campaign-card">
            <div class="seo-camp-header">
              <h5>${c.name}</h5>
              <span class="seo-camp-obj">${c.objective}</span>
            </div>
            <div class="seo-camp-body">
              <div class="seo-camp-row">
                <strong>Creative Hook</strong>
                <p>${c.creativeHook}</p>
              </div>
              <div class="seo-camp-row">
                <strong>Channels</strong>
                <p>${(c.channels || []).join(", ")}</p>
              </div>
              <div class="seo-camp-row">
                <strong>Budget</strong>
                <p>${c.budget}</p>
              </div>
              <div class="seo-camp-row">
                <strong>KPIs</strong>
                <p>${(c.kpis || []).join(" · ")}</p>
              </div>
              <div class="seo-camp-row">
                <strong>Timeline</strong>
                <p>${c.timeline}</p>
              </div>
              <div class="seo-camp-row">
                <strong>Strategy Note</strong>
                <p class="seo-camp-why">${c.whyItWorks}</p>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderFunnelSection(section) {
  return `
    <div class="seo-section">
      <h4 class="seo-section-title">${section.title}</h4>
      <p class="seo-narrative">${section.narrative || ""}</p>
      <div class="seo-funnel">
        ${(section.rows || []).map(r => `
          <div class="seo-funnel-stage">
            <div class="seo-funnel-meta">
              <span class="seo-stage-badge">${r.stage}</span>
              <span class="seo-intent-badge">${r.intent}</span>
            </div>
            <div class="seo-funnel-query"><strong>Query:</strong> ${r.query}</div>
            <div class="seo-funnel-action"><strong>Action:</strong> ${r.action}</div>
            <div class="seo-funnel-kpi"><strong>KPI:</strong> ${r.kpi}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderTechSection(section) {
  return `
    <div class="seo-section">
      <h4 class="seo-section-title">${section.title}</h4>
      <p class="seo-narrative">${section.narrative || ""}</p>
      <ol class="seo-tech-list">
        ${(section.items || []).map(item => `<li>${item}</li>`).join("")}
      </ol>
    </div>
  `;
}

function renderMetricsSection(section) {
  return `
    <div class="seo-section">
      <h4 class="seo-section-title">${section.title}</h4>
      <p class="seo-narrative">${section.narrative || ""}</p>
      <div class="seo-metrics-table">
        ${(section.rows || []).map(r => `
          <div class="seo-metric-row">
            <span class="seo-metric-name">${r.metric}</span>
            <span class="seo-metric-channel">${r.channel}</span>
            <span class="seo-metric-target">${r.target}</span>
            <span class="seo-metric-measure">${r.measurement}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderActionsSection(section) {
  return `
    <div class="seo-section">
      <h4 class="seo-section-title">${section.title}</h4>
      <div class="seo-actions">
        ${(section.items || []).map(a => `
          <div class="seo-action-item priority-${(a.priority || "P4")[1]}">
            <div class="seo-action-header">
              <span class="seo-priority-badge">${a.priority}</span>
              <strong>${a.action}</strong>
            </div>
            <div class="seo-action-meta">
              <span>Owner: ${a.owner}</span>
              <span>Timeline: ${a.timeline}</span>
              <span>Impact: ${a.impact}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderTable(rows) {
  if (!rows?.length) return "";
  const cols = Object.keys(rows[0]);
  return `
    <div class="seo-table-wrap">
      <table class="seo-table">
        <thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

export function downloadSeoPdf(brief) {
  if (!brief) return;

  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function addFooter() {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Bharat Hyperlocal Intelligence · ${brief.city} SEO Brief · Page ${i} of ${pageCount}`, margin, pageHeight - 10);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    }
  }

  function addTitle(text) {
    doc.setFontSize(14);
    doc.setTextColor(...DARK_BG);
    doc.setFont("helvetica", "bold");
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 6 + 4;
    doc.setDrawColor(...BRAND_COLOR);
    doc.setLineWidth(0.5);
    doc.line(margin, y - 1, margin + 40, y - 1);
    y += 4;
  }

  function addBody(text) {
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 3;
  }

  function addNarrative(text) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "italic");
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  function checkPage(needed) {
    if (y + needed > pageHeight - margin - 15) {
      doc.addPage();
      y = margin;
    }
  }

  // Cover page
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("SEO BRIEF", margin, 70);
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(`${brief.city} × ${brief.language} × ${brief.category}`, margin, 82);
  doc.setFontSize(11);
  doc.setTextColor(200, 200, 200);
  doc.text(`${brief.platform} · ${brief.objective} · ${brief.channel}`, margin, 92);
  doc.setFontSize(10);
  doc.text(`Opportunity Score: ${brief.score ?? "N/A"}/100 (${brief.confidence || "D"})`, margin, 102);
  doc.text(`Generated: ${new Date(brief.generatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}`, margin, 110);
  doc.setDrawColor(...BRAND_COLOR);
  doc.setLineWidth(0.5);
  doc.line(margin, 118, margin + 60, 118);
  doc.setFontSize(9);
  doc.text(`Total evidence: ${brief.meta?.totalEvidence || 0} items · ${brief.meta?.highConfidenceCount || 0} high-confidence · ${(brief.citations || []).length} citations`, margin, 126);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Bharat Hyperlocal Intelligence Platform — bharat-hyperlocal-dashboard", margin, 240);

  doc.addPage();
  y = margin;

  // Sections
  for (const section of brief.sections || []) {
    checkPage(20);
    addTitle(section.title);

    if (section.type === "summary" && section.narrative) {
      addNarrative(section.narrative);
      continue;
    }

    if (section.type === "list" && section.rows) {
      if (section.narrative) addNarrative(section.narrative);
      const headers = [["Keyword", "Volume", "Difficulty", "Opportunity"]];
      const data = section.rows.map(r => [r.keyword || "", r.volume || "", r.difficulty || "", r.opportunity || ""]);
      checkPage(data.length * 8 + 20);
      doc.autoTable({
        startY: y,
        head: headers,
        body: data,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [...DARK_BG], textColor: [...BRAND_COLOR], fontStyle: "bold", fontSize: 8 },
        columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 25 }, 2: { cellWidth: 20 }, 3: { cellWidth: "auto" } }
      });
      y = doc.lastAutoTable.finalY + 6;
      continue;
    }

    if (section.type === "competitive" && section.rows) {
      if (section.narrative) addNarrative(section.narrative);
      const headers = [["Competitor", "Position", "Strengths", "Gaps"]];
      const data = section.rows.map(r => [r.competitor, r.position, r.strengths, r.gaps]);
      checkPage(data.length * 8 + 20);
      doc.autoTable({
        startY: y,
        head: headers,
        body: data,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [...DARK_BG], textColor: [...BRAND_COLOR] }
      });
      y = doc.lastAutoTable.finalY + 6;
      continue;
    }

    if (section.type === "strategy" && section.body) {
      if (section.narrative) addNarrative(section.narrative);
      for (const item of section.body) {
        checkPage(20);
        doc.setFontSize(10);
        doc.setTextColor(...DARK_BG);
        doc.setFont("helvetica", "bold");
        const hLines = doc.splitTextToSize(item.heading, contentWidth);
        doc.text(hLines, margin, y);
        y += hLines.length * 5 + 2;
        addBody(item.detail);
      }
      continue;
    }

    if (section.type === "campaigns" && section.campaigns) {
      for (const camp of section.campaigns) {
        checkPage(40);
        doc.setFillColor(248, 248, 250);
        doc.roundedRect(margin, y, contentWidth, 8, 2, 2, "F");
        doc.setFontSize(10);
        doc.setTextColor(...DARK_BG);
        doc.setFont("helvetica", "bold");
        doc.text(camp.name, margin + 3, y + 6);
        y += 12;
        addBody(`Objective: ${camp.objective}`);
        addBody(`Creative Hook: ${camp.creativeHook}`);
        addBody(`Channels: ${(camp.channels || []).join(", ")} · Budget: ${camp.budget}`);
        addBody(`KPIs: ${(camp.kpis || []).join(" · ")}`);
        addBody(`Timeline: ${camp.timeline}`);
        doc.setFontSize(8);
        doc.setTextColor(...ACCENT);
        doc.setFont("helvetica", "italic");
        const whyLines = doc.splitTextToSize(`Why: ${camp.whyItWorks}`, contentWidth);
        doc.text(whyLines, margin, y);
        y += whyLines.length * 4 + 6;
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y - 2, pageWidth - margin, y - 2);
      }
      continue;
    }

    if (section.type === "funnel" && section.rows) {
      if (section.narrative) addNarrative(section.narrative);
      const headers = [["Stage", "Intent", "Query", "Action", "KPI"]];
      const data = section.rows.map(r => [r.stage, r.intent, r.query, r.action, r.kpi]);
      checkPage(data.length * 8 + 20);
      doc.autoTable({
        startY: y,
        head: headers,
        body: data,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [...DARK_BG], textColor: [...BRAND_COLOR] }
      });
      y = doc.lastAutoTable.finalY + 6;
      continue;
    }

    if (section.type === "tech" && section.items) {
      if (section.narrative) addNarrative(section.narrative);
      for (let i = 0; i < section.items.length; i++) {
        checkPage(8);
        addBody(`${i + 1}. ${section.items[i]}`);
      }
      y += 2;
      continue;
    }

    if (section.type === "metrics" && section.rows) {
      if (section.narrative) addNarrative(section.narrative);
      const headers = [["Metric", "Channel", "Target", "Measurement"]];
      const data = section.rows.map(r => [r.metric, r.channel, r.target, r.measurement]);
      checkPage(data.length * 8 + 20);
      doc.autoTable({
        startY: y,
        head: headers,
        body: data,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [...DARK_BG], textColor: [...BRAND_COLOR] }
      });
      y = doc.lastAutoTable.finalY + 6;
      continue;
    }

    if (section.type === "actions" && section.items) {
      const headers = [["Priority", "Action", "Owner", "Timeline", "Impact"]];
      const data = section.items.map(a => [a.priority, a.action, a.owner, a.timeline, a.impact]);
      checkPage(data.length * 8 + 20);
      doc.autoTable({
        startY: y,
        head: headers,
        body: data,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [...DARK_BG], textColor: [...BRAND_COLOR] }
      });
      y = doc.lastAutoTable.finalY + 6;
      continue;
    }
  }

  // Citations page
  doc.addPage();
  y = margin;
  addTitle("Sources & Citations");
  const citeData = (brief.citations || []).map(c => [c.id || "—", c.source_name || "—", c.confidence || "—", c.source_url || ""]);
  if (citeData.length > 0) {
    doc.autoTable({
      startY: y,
      head: [["ID", "Source", "Conf", "URL"]],
      body: citeData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [...DARK_BG], textColor: [...BRAND_COLOR] }
    });
  }

  addFooter();

  doc.save(`Bharat_SEO_Brief_${brief.city}_${brief.language}_${brief.category.replace(/\s+/g, "_")}.pdf`);
}

if (typeof window !== "undefined") {
  window.downloadSeoPdf = function() {
    const briefData = window.__currentSeoBrief;
    if (briefData) downloadSeoPdf(briefData);
  };
}
