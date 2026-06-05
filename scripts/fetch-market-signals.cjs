#!/usr/bin/env node

/**
 * fetch-market-signals.js
 *
 * Free, zero-API-key market signal fetcher for Indian quick-commerce brands.
 * Uses Google News RSS (completely free, no rate limits) to find new articles,
 * parses them into the same signal format as the existing data files.
 *
 * Run: node scripts/fetch-market-signals.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public', 'data');

const BRANDS = {
  Blinkit: ['Blinkit', 'Zomato', 'Eternal', 'blinkit'],
  'Swiggy Instamart': ['Swiggy Instamart', 'Swiggy', 'instamart'],
  Zepto: ['Zepto', 'zepto'],
  BigBasket: ['BigBasket', 'BigBasket Now', 'Tata Digital', 'bigbasket'],
  Dunzo: ['Dunzo', 'dunzo'],
};

const EVENT_TYPES = [
  'GOV/GMV/revenue update',
  'dark store/expansion update',
  'profitability/loss/margin',
  'retail media/advertising signal',
  'competitive move',
  'funding/investment',
  'consumer behavior signal',
  'operational risk signal',
];

function parseRSSItems(xmlText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const source = extractTag(block, 'source');
    const description = extractTag(block, 'description')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
      .substring(0, 500);

    if (title && link) {
      items.push({
        title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'),
        link,
        pubDate: parseDate(pubDate),
        source: source || extractDomain(link),
        description,
      });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(regex);
  return m ? m[1].trim() : '';
}

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch { return ''; }
}

function parseDate(str) {
  if (!str) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
  } catch { return new Date().toISOString().split('T')[0]; }
}

function classifyEvent(title, description) {
  const text = (title + ' ' + description).toLowerCase();

  if (text.includes('gov') || text.includes('revenue') || text.includes('gmv') || text.includes('order value')) return EVENT_TYPES[0];
  if (text.includes('store') || text.includes('expansion') || text.includes('dark store') || text.includes('new city')) return EVENT_TYPES[1];
  if (text.includes('profit') || text.includes('ebitda') || text.includes('loss') || text.includes('margin')) return EVENT_TYPES[2];
  if (text.includes('advertis') || text.includes('media') || text.includes('retail media')) return EVENT_TYPES[3];
  if (text.includes('competition') || text.includes('market share') || text.includes('vs ')) return EVENT_TYPES[4];
  if (text.includes('funding') || text.includes('invest') || text.includes('valuation') || text.includes('ipo')) return EVENT_TYPES[5];
  if (text.includes('consumer') || text.includes('user') || text.includes('demand') || text.includes('trend')) return EVENT_TYPES[6];
  if (text.includes('risk') || text.includes('shutdown') || text.includes('distress') || text.includes('layoff')) return EVENT_TYPES[7];

  return EVENT_TYPES[0];
}

function identifyBrand(text) {
  for (const [brand, keywords] of Object.entries(BRANDS)) {
    for (const kw of keywords) {
      if (text.toLowerCase().includes(kw.toLowerCase())) return brand;
    }
  }
  return null;
}

function generateId(brand, index) {
  const prefix = brand.substring(0, 3).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}_RSS_${ts}_${index}`;
}

function isDuplicate(existingSignals, title, link) {
  return existingSignals.some(
    (s) =>
      s.signal_summary?.toLowerCase().includes(title.substring(0, 40).toLowerCase()) ||
      s.source_url === link
  );
}

async function fetchRSS(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  }
}

async function main() {
  console.log('=== Bharat Hyperlocal - Market Signal Fetcher ===');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  // Load existing signals
  const signalsPath = path.join(DATA_DIR, 'market_signals_2025_2026.json');
  let existingData = { signals: [], sources: [], version: new Date().toISOString().split('T')[0], research_period: 'ongoing', generated_at: new Date().toISOString().split('T')[0], methodology: 'Automated RSS + Google News aggregation. New signals marked needs_validation until reviewed.' };
  try {
    existingData = JSON.parse(fs.readFileSync(signalsPath, 'utf-8'));
    console.log(`Loaded ${existingData.signals.length} existing signals`);
  } catch {
    console.log('No existing signals file found, starting fresh');
  }

  const existingSignals = existingData.signals || [];
  const existingSources = existingData.sources || [];
  const newSignals = [];

  // Build RSS URLs for each brand
  const queries = [
    'quick commerce India',
    'quick commerce market India',
    'Blinkit quick commerce',
    'Zepto quick commerce',
    'Swiggy Instamart',
    'BigBasket quick commerce',
    'Dunzo delivery',
    'online grocery delivery India',
    'dark stores India',
  ];

  const feedUrls = queries.map(
    (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`
  );

  const allRssItems = [];
  for (let i = 0; i < feedUrls.length; i++) {
    process.stdout.write(`Fetching RSS feed ${i + 1}/${feedUrls.length}... `);
    const xml = await fetchRSS(feedUrls[i]);
    if (xml) {
      const items = parseRSSItems(xml);
      allRssItems.push(...items);
      console.log(`${items.length} items`);
    } else {
      console.log('failed');
    }
    // Small delay to be polite
    await new Promise((r) => setTimeout(r, 500));
  }

  // Deduplicate by link
  const seenLinks = new Set();
  const uniqueItems = allRssItems.filter((item) => {
    if (seenLinks.has(item.link)) return false;
    seenLinks.add(item.link);
    return true;
  });

  console.log(`\nTotal unique items: ${uniqueItems.length}`);

  // Process items into signals
  let added = 0;
  let brandItemCount = {};

  uniqueItems.forEach((item, idx) => {
    const text = item.title + ' ' + item.description;
    const brand = identifyBrand(text);

    if (!brand) return;

    brandItemCount[brand] = (brandItemCount[brand] || 0) + 1;

    if (isDuplicate(existingSignals, item.title, item.link)) return;

    const eventType = classifyEvent(item.title, item.description);
    const metricMatch = item.description.match(/(\d+[\d,.]*\s*(?:INR|Rs|crore|crores|million|billion|%)?)/i);

    const signal = {
      id: generateId(brand, idx),
      date_published: item.pubDate,
      period_covered: item.pubDate,
      brand,
      event_type: eventType,
      signal_summary: `${item.title}${item.description ? '. ' + item.description.substring(0, 200) : ''}`,
      hard_metric_available: !!metricMatch,
      metric_name: metricMatch ? 'Detected metric' : '',
      metric_value: metricMatch ? metricMatch[1] : '',
      metric_unit: 'See source',
      metric_type: 'automated',
      source_name: item.source || extractDomain(item.link),
      source_url: item.link,
      source_type: 'news-rss',
      confidence: 'D',
      business_impact_score: 50,
      dashboard_module_mapping: 'Market Signals',
      recommended_dashboard_action: 'Review and validate before use in analysis.',
      limitation_or_caveat: 'Auto-fetched from RSS. Not verified against primary source. Treat as D-confidence signal until reviewed.',
      needs_validation: true,
    };

    newSignals.push(signal);
    added++;
  });

  console.log(`\nNew signals found: ${added}`);
  for (const [brand, count] of Object.entries(brandItemCount)) {
    console.log(`  ${brand}: ${count} articles found`);
  }

  if (added === 0) {
    console.log('\nNo new signals to add.');
    return;
  }

  // Merge: new signals at the top
  existingData.signals = [...newSignals, ...existingSignals];
  existingData.version = new Date().toISOString().split('T')[0];
  existingData.generated_at = new Date().toISOString().split('T')[0];
  existingData.last_updated = new Date().toISOString().split('T')[0];

  // Add new sources
  const existingSourceNames = new Set(existingSources.map((s) => s.id));
  newSignals.forEach((s) => {
    if (s.source_name && !existingSourceNames.has(s.source_name)) {
      existingSources.push({
        id: s.source_name,
        name: s.source_name,
        url_prefix: s.source_url,
        type: 'news-rss',
        confidence: 'D',
      });
      existingSourceNames.add(s.source_name);
    }
  });

  // Write updated data
  const output = JSON.stringify(existingData, null, 2);
  fs.writeFileSync(signalsPath, output, 'utf-8');
  console.log(`\nUpdated: ${signalsPath}`);

  // Also write to public/data/ for Vite
  if (fs.existsSync(PUBLIC_DIR)) {
    fs.writeFileSync(path.join(PUBLIC_DIR, 'market_signals_2025_2026.json'), output, 'utf-8');
    console.log(`Updated: ${path.join(PUBLIC_DIR, 'market_signals_2025_2026.json')}`);
  }

  console.log(`\nTotal signals now: ${existingData.signals.length}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});