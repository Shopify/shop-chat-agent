/**
 * Shared CORS helpers.
 *
 * The chat endpoints used to reflect whatever Origin they were given, which let
 * any website read responses cross-origin. We now only echo an Origin we trust.
 * Set ALLOWED_ORIGINS to a comma-separated list of storefront origins in
 * production; localhost is allowed automatically in development.
 */

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * @param {string|null} origin - The request's Origin header
 * @returns {boolean} - Whether we trust this origin
 */
export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (allowedOrigins().includes(origin)) return true;

  if (process.env.NODE_ENV !== "production") {
    try {
      const { hostname } = new URL(origin);
      return hostname === "localhost" || hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * CORS origin headers for a request, or an empty object when the Origin is not
 * trusted (so the browser blocks the cross-origin read).
 * @param {Request} request
 * @returns {Object}
 */
export function corsOriginHeaders(request) {
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}
