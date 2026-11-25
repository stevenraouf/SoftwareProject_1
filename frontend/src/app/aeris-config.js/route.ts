export const dynamic = "force-dynamic";

// The static homepage and on-demand pages share one deployment configuration.
// These are the only two settings intended for the browser.
export function GET() {
  const { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: key } = process.env;
  const config = {
    apiBase:
      process.env.AERIS_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://localhost:3443/api",
    stripePublic: key?.startsWith("pk_test_") ? key : "",
  };
  return new Response("window.aerisConfig = " + JSON.stringify(config) + ";", {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
