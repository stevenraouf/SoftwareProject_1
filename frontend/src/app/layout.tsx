import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "@fontsource-variable/dm-sans/index.css";
import "@fontsource-variable/source-sans-3/index.css";
import "./style.css";
import "./shell-motion.css";
import { SessionProvider } from "@/lib/session";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: { default: "AERIS · The window seat", template: "%s · AERIS" },
  description:
    "Plan your route, find flights and stays, and keep a journal of your travels.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              const saved = localStorage.getItem("aeris-motion") === "reduced";
              if (saved || matchMedia("(prefers-reduced-motion: reduce)").matches) {
                document.documentElement.dataset.motion = "reduced";
              }
            } catch {}`,
          }}
        />
      </head>
      <body>
        <Script src="/aeris-config.js" strategy="beforeInteractive" />
        <SessionProvider>
          <Shell>{children}</Shell>
        </SessionProvider>
      </body>
    </html>
  );
}
