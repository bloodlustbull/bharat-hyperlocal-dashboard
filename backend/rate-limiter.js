const buckets = new Map();
const GLOBAL = { tokens: 200, lastRefill: Date.now(), capacity: 200, refillPerSec: 200 };
const PER_IP = { capacity: 30, refillPerSec: 10 };

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function refillBucket(bucket, capacity, refillPerSec) {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  const refill = elapsed * refillPerSec;
  bucket.tokens = Math.min(capacity, bucket.tokens + refill);
  bucket.lastRefill = now;
}

function tryConsume(tokens = 1) {
  refillBucket(GLOBAL, GLOBAL.capacity, GLOBAL.refillPerSec);
  if (GLOBAL.tokens < tokens) return { allowed: false, scope: "global", retryAfter: Math.ceil((tokens - GLOBAL.tokens) / GLOBAL.refillPerSec) };
  GLOBAL.tokens -= tokens;
  return { allowed: true, scope: "global", remaining: Math.floor(GLOBAL.tokens) };
}

function tryConsumeIp(ip, tokens = 1) {
  let bucket = buckets.get(ip);
  if (!bucket) { bucket = { tokens: PER_IP.capacity, lastRefill: Date.now() }; buckets.set(ip, bucket); }
  refillBucket(bucket, PER_IP.capacity, PER_IP.refillPerSec);
  if (bucket.tokens < tokens) {
    return { allowed: false, scope: "ip", ip, retryAfter: Math.ceil((tokens - bucket.tokens) / PER_IP.refillPerSec) };
  }
  bucket.tokens -= tokens;
  return { allowed: true, scope: "ip", ip, remaining: Math.floor(bucket.tokens) };
}

function rateLimitMiddleware(weight = 1) {
  return (req, res) => {
    const ip = getClientIp(req);
    const g = tryConsume(weight);
    if (!g.allowed) {
      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": String(g.retryAfter) });
      res.end(JSON.stringify({ error: "rate_limited", scope: g.scope, retryAfter: g.retryAfter }));
      return false;
    }
    const r = tryConsumeIp(ip, weight);
    if (!r.allowed) {
      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": String(r.retryAfter) });
      res.end(JSON.stringify({ error: "rate_limited", scope: r.scope, retryAfter: r.retryAfter }));
      return false;
    }
    res.setHeader("X-RateLimit-Remaining", String(r.remaining));
    return true;
  };
}

function getStats() {
  refillBucket(GLOBAL, GLOBAL.capacity, GLOBAL.refillPerSec);
  return {
    global: { tokens: Math.floor(GLOBAL.tokens), capacity: GLOBAL.capacity, refillPerSec: GLOBAL.refillPerSec },
    perIp: { capacity: PER_IP.capacity, refillPerSec: PER_IP.refillPerSec, activeIps: buckets.size }
  };
}

function resetIps() { buckets.clear(); }

export { rateLimitMiddleware, getStats, resetIps, getClientIp };
