/*
  ScorerEngine keeps the opportunity score formula in one small file.
  The dashboard calls this module after city_language_seed.json is loaded.
*/

(function () {
  const WEIGHTS = {
    normalized_penetration: 0.3,
    normalized_aov: 0.25,
    dark_store_density: 0.2,
    smartphone_score: 0.15,
    platform_gap_score: 0.1
  };

  const JUSTIFICATIONS = {
    normalized_penetration: "Penetration shows current quick-commerce adoption depth.",
    normalized_aov: "AOV indicates likely basket quality for paid acquisition.",
    dark_store_density: "Dark-store density supports faster serviceability and fulfillment.",
    smartphone_score: "Smartphone penetration supports app-first campaign response.",
    platform_gap_score: "Platform gap favors wedges where the selected platform is not already dominant."
  };

  function maxOf(cities, key) {
    return Math.max(...cities.map(city => Number(city[key] || 0)), 1);
  }

  function platformGapScore(city, platformName) {
    if (!platformName) return 60;
    if (platformName.toLowerCase().includes("dunzo")) return 35;
    return city.platform_leader === platformName ? 42 : 76;
  }

  function calculate(city, platformName, seedData) {
    const cities = seedData?.cities || [];
    const maxPenetration = maxOf(cities, "q_commerce_penetration_pct");
    const maxAov = maxOf(cities, "avg_aov_inr");
    const maxStores = maxOf(cities, "dark_store_count");
    const components = {
      normalized_penetration: (Number(city.q_commerce_penetration_pct || 0) / maxPenetration) * 100,
      normalized_aov: (Number(city.avg_aov_inr || 0) / maxAov) * 100,
      dark_store_density: (Number(city.dark_store_count || 0) / maxStores) * 100,
      smartphone_score: Number(city.smartphone_penetration_pct || 0),
      platform_gap_score: platformGapScore(city, platformName)
    };

    const breakdown = Object.entries(WEIGHTS).map(([key, weight]) => ({
      key,
      label: key.replaceAll("_", " "),
      weight,
      value: Math.round(components[key]),
      contribution: components[key] * weight,
      justification: JUSTIFICATIONS[key]
    }));

    const score = Math.round(breakdown.reduce((sum, item) => sum + item.contribution, 0));
    return { score, breakdown, components, weights: WEIGHTS };
  }

  window.ScorerEngine = { calculate, weights: WEIGHTS, justifications: JUSTIFICATIONS };
})();
