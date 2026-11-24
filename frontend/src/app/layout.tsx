import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "@fontsource-variable/dm-sans/index.css";
import "@fontsource-variable/source-sans-3/index.css";
import "./style.css";
import { SessionProvider } from "@/lib/session";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: { default: "AERIS · The window seat", template: "%s · AERIS" },
  description:
    "Plan your route, find flights and stays, and keep a journal of your travels.",
};
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: ReactNode }) {
  const { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: stripePublic } = process.env;
  return (
    <html lang="en">
      <head>
        <meta
          name="aeris-api"
          content={
            process.env.AERIS_API_BASE_URL ||
            process.env.NEXT_PUBLIC_API_BASE_URL ||
            "https://localhost:3443/api"
          }
        />
        <meta
          name="aeris-stripe-public"
          content={stripePublic?.startsWith("pk_test_") ? stripePublic : ""}
        />
      </head>
      <body>
        <SessionProvider>
          <Shell>{children}</Shell>
        </SessionProvider>
      </body>
    </html>
  );
}
