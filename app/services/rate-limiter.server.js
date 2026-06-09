/**
 * Tiny in-memory rate limiter (fixed window).
 *
 * This is per-process, which is enough for the reference app. A multi-instance
 * deployment should swap this for a shared store (e.g. Redis).
 */

const DEFAULT_WINDOW_MS = 60 * 1000;
const SWEEP_INTERVAL_MS = 1000;
const buckets = new Map();
let lastSweepAt = 0;

/**
 * @param {string} key - Identifier to rate limit on
 * @param {number} limit - Max requests allowed within the window
 * @param {number} [windowMs] - Window length in milliseconds
 * @returns {boolean} - true if allowed, false if the request should be blocked
 */
export function allowRequest(key, limit, windowMs = DEFAULT_WINDOW_MS) {
  const now = Date.now();
  sweepExpiredBuckets(now);

  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export function rateLimitExceeded(request, endpoint, limit) {
  const key = clientKey(request);
  return Boolean(key && !allowRequest(`${endpoint}:${key}`, limit));
}

function sweepExpiredBuckets(now) {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;

  lastSweepAt = now;
  for (const [bucketKey, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(bucketKey);
  }
}

/**
 * Build a rate-limit key from the caller's IP.
 *
 * This assumes production requests arrive through a proxy that appends to
 * X-Forwarded-For. Direct clients can spoof this header.
 *
 * @param {Request} request
 * @returns {string|null}
 */
export function clientKey(request) {
  const forwarded = (request.headers.get("X-Forwarded-For") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return forwarded[forwarded.length - 1] || null;
}
