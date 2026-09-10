/**
 * UCP agent profile
 *
 * Served unauthenticated at /.well-known/ucp-agent.json. Shopify fetches this
 * during UCP discovery on every /api/ucp/mcp tools/call. It MUST be returned as
 * Content-Type: application/json — a text/plain body makes discovery fail with
 * `-32001 UCP discovery failed / profile_malformed / "Invalid content type"`.
 */
import AppConfig from "../services/config.server";

export async function loader() {
  const profile = {
    ucp: {
      version: AppConfig.ucp.version,
      services: AppConfig.ucp.services,
      capabilities: AppConfig.ucp.capabilities,
      payment_handlers: {},
    },
  };

  return new Response(JSON.stringify(profile, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
