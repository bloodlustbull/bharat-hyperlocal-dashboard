import { loadStoredEvidence } from "./evidence-store.js";
import { getState, markAgentStart, markAgentComplete, logEntry } from "./pipeline-store.js";

export async function runBriefGeneration(cities, categories) {
  const t0 = Date.now();
  markAgentStart("brief");
  logEntry("brief", "info", "Starting automated brief generation from live signals");

  const stored = await loadStoredEvidence();
  const items = stored.evidence || [];
  const briefs = [];

  for (const city of cities) {
    for (const category of categories) {
      const relevant = items.filter(i =>
        i.city?.toLowerCase() === city.toLowerCase() &&
        i.category?.toLowerCase() === category.toLowerCase()
      );
      if (relevant.length < 3) continue;

      const highConf = relevant.filter(i => ["A", "B"].includes(i.confidence));
      const signals = [
        ...new Set(relevant.filter(i => i.source_type === "google_news_rss").map(i => i.claim))
      ].slice(0, 3);
      const sources = [...new Set(relevant.map(i => i.source_type))];
      const trendItems = relevant.filter(i => i.source_type === "google_trends_rss");
      const redditItems = relevant.filter(i => i.source_type?.includes("reddit"));

      const brief = {
        id: `auto-brief-${city}-${category}-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        city,
        category,
        totalEvidence: relevant.length,
        highConfidence: highConf.length,
        sourceTypes: sources,
        signals,
        trends: trendItems.slice(0, 3).map(i => i.claim),
        redditInsights: redditItems.slice(0, 3).map(i => i.claim),
        hasActionableSignal: highConf.length >= 2,
        recommendation: highConf.length >= 2
          ? `Actionable signal detected for ${city} ${category}. ${signals.length > 0 ? `Key news: ${signals[0]}` : ""} Consider running the full SEO brief.`
          : `Insufficient high-confidence signals for ${city} ${category}. Run live ingestion to enrich evidence.`
      };

      briefs.push(brief);
    }
  }

  const duration = Date.now() - t0;
  markAgentComplete("brief", briefs.length, duration);
  logEntry("brief", "info", `Generated ${briefs.length} briefs in ${duration}ms`);
  return { briefsGenerated: briefs.length, briefs, durationMs: duration };
}
