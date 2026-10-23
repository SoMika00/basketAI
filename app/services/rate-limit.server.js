/**
 * Rate Limit Service
 * In-memory sliding-window rate limiter for the chat API.
 *
 * Keys are per-conversation (conversation_id) or, when absent, per client IP.
 * No external dependencies are used.
 */

const DEFAULT_MAX = 20;
const DEFAULT_WINDOW_MS = 60000;

/**
 * In-memory store of request timestamps keyed by rate-limit key.
 * @type {Map<string, number[]>}
 */
let buckets = new Map();

/**
 * Reads the configured max requests per window.
 * @returns {number}
 */
function getMax() {
  const raw = process.env.CHAT_RATE_LIMIT_MAX;
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX;
}

/**
 * Reads the configured window duration in milliseconds.
 * @returns {number}
 */
function getWindowMs() {
  const raw = process.env.CHAT_RATE_LIMIT_WINDOW_MS;
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WINDOW_MS;
}

/**
 * Removes timestamps that fall outside the current sliding window.
 * @param {number[]} timestamps - Timestamps for a single key
 * @param {number} now - Current time in milliseconds
 * @param {number} windowMs - Window duration in milliseconds
 * @returns {number[]} Timestamps still within the window
 */
function prune(timestamps, now, windowMs) {
  const cutoff = now - windowMs;
  let firstValid = 0;
  while (firstValid < timestamps.length && timestamps[firstValid] <= cutoff) {
    firstValid += 1;
  }
  return firstValid === 0 ? timestamps : timestamps.slice(firstValid);
}

/**
 * Records a request for the given key and returns whether it is allowed.
 *
 * @param {string} key - The rate-limit key (conversation id or client IP)
 * @returns {{ allowed: boolean, retry_after_seconds: number }}
 */
function check(key) {
  const max = getMax();
  const windowMs = getWindowMs();
  const now = Date.now();

  let timestamps = buckets.get(key) || [];
  timestamps = prune(timestamps, now, windowMs);

  if (timestamps.length >= max) {
    // The oldest request in the window determines when a slot frees up.
    const oldest = timestamps[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    buckets.set(key, timestamps);
    return {
      allowed: false,
      retry_after_seconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true, retry_after_seconds: 0 };
}

/**
 * Returns the current status for a key without recording a request.
 *
 * @param {string} key - The rate-limit key
 * @returns {{ count: number, max: number, window_ms: number, remaining: number }}
 */
function getRateLimitStatus(key) {
  const max = getMax();
  const windowMs = getWindowMs();
  const now = Date.now();
  const timestamps = prune(buckets.get(key) || [], now, windowMs);
  return {
    count: timestamps.length,
    max,
    window_ms: windowMs,
    remaining: Math.max(0, max - timestamps.length),
  };
}

/**
 * Derives the rate-limit key for a request.
 *
 * When a conversationId is provided it is used directly (prefixed with
 * `conversation:`). Otherwise the key is derived from common proxy IP headers
 * (`X-Forwarded-For` first hop, then `X-Real-IP`, then `CF-Connecting-IP`),
 * falling back to `ip:unknown`.
 *
 * @param {Request} request - The request object
 * @param {string} [conversationId] - Optional conversation identifier
 * @returns {string} The rate-limit key
 */
function deriveRateLimitKey(request, conversationId) {
  if (conversationId) {
    return `conversation:${conversationId}`;
  }

  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    return `ip:${forwardedFor.split(",")[0].trim()}`;
  }

  const realIp = request.headers.get("X-Real-IP");
  if (realIp) {
    return `ip:${realIp.trim()}`;
  }

  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) {
    return `ip:${cfIp.trim()}`;
  }

  return "ip:unknown";
}

/**
 * Clears all recorded request timestamps. Intended for tests.
 */
function resetRateLimiter() {
  buckets = new Map();
}

export { check, getRateLimitStatus, resetRateLimiter, deriveRateLimitKey };

export default {
  check,
  getRateLimitStatus,
  resetRateLimiter,
  deriveRateLimitKey,
};
