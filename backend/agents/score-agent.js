import { loadStoredEvidence, saveEvidence, getEvidenceStats } from "./evidence-store.js";
import { markAgentStart, markAgentComplete, logEntry } from "./pipeline-store.js";

export async function runScoring(cities, categories) {
  const t0 = Date.now();
  markAgentStart("score");
  logEntry("score", "info", "Starting live score analysis");

  const stored = await loadStoredEvidence();
  const items = stored.evidence || [];
  const stats = await getEvidenceStats();
  let deltas = [];

  for (const city of cities) {
    for (const category of categories) {
      const cityItems = items.filter(i =>
        i.city?.toLowerCase() === city.toLowerCase() &&
        i.category?.toLowerCase() === category.toLowerCase()
      );

      const highConfCount = cityItems.filter(i => ["A", "B"].includes(i.confidence)).length;
      const recentCount = cityItems.filter(i => {
        const age = Date.now() - new Date(i.captured_at || Date.now()).getTime();
        return age < 7 * 24 * 60 * 60 * 1000;
      }).length;
      const sourceDiversity = new Set(cityItems.map(i => i.source_type)).size;
      const hasNews = cityItems.some(i => i.source_type === "google_news_rss");
      const hasReddit = cityItems.some(i => i.source_type?.includes("reddit"));
      const hasTrends = cityItems.some(i => i.source_type === "google_trends_rss");
      const totalForCity = cityItems.length;

      // Compute live signal delta: -20 to +20
      let delta = 0;
      if (highConfCount > 3) delta += 5;
      else if (highConfCount > 0) delta += 2 + highConfCount;
      if (sourceDiversity >= 3) delta += 4;
      else if (sourceDiversity >= 2) delta += 2;
      if (recentCount > 5) delta += 4;
      else if (recentCount > 0) delta += 2;
      if (hasNews) delta += 3;
      if (hasReddit) delta += 2;
      if (hasTrends) delta += 2;

      deltas.push({
        city,
        category,
        totalEvidence: totalForCity,
        highConfidenceCount: highConfCount,
        recentItems: recentCount,
        sourceDiversity,
        hasNews,
        hasReddit,
        hasTrends,
        signalDelta: Math.min(delta, 20),
        lastUpdated: new Date().toISOString()
      });
    }
  }

  deltas.sort((a, b) => b.signalDelta - a.signalDelta);

  const duration = Date.now() - t0;
  markAgentComplete("score", deltas.length, duration);

  return {
    deltas,
    stats,
    scoreCount: deltas.length,
    highestDelta: deltas[0] || null,
    durationMs: duration
  };
}

export function computeLiveDelta(deltas, city, category) {
  const match = (deltas || []).find(d =>
    d.city?.toLowerCase() === city?.toLowerCase() &&
    d.category?.toLowerCase() === category?.toLowerCase()
  );
  return match || { signalDelta: 0, totalEvidence: 0, sourceDiversity: 0 };
}

export function getDeltaLabel(delta) {
  if (delta >= 15) return "Strong live signal";
  if (delta >= 10) return "Moderate live signal";
  if (delta >= 5) return "Weak live signal";
  return "No significant live signal";
}
