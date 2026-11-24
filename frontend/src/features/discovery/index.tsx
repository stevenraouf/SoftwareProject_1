"use client";

import { Suspense } from "react";
import { useSession } from "@/lib/session";
import { AuthorPage, Journal, StoryPage } from "./journal";
import { Planner, PlanPage } from "./planner";
import { ReferencesProvider } from "./planner-data";
import "./discovery.css";

export default function DiscoveryFeature({
  view,
  id,
}: {
  view: string;
  id?: string;
}) {
  const { user } = useSession();
  return (
    <main className="discovery" key={[view, id, user?.id].join(":")}>
      <Suspense fallback={<p role="status">Loading…</p>}>
        {view === "journal" ? (
          <Journal />
        ) : view === "post" && id ? (
          <StoryPage id={id} />
        ) : view === "author" && id ? (
          <AuthorPage id={id} />
        ) : (
          <ReferencesProvider>
            {view === "itinerary" && id ? <PlanPage id={id} /> : <Planner />}
          </ReferencesProvider>
        )}
      </Suspense>
    </main>
  );
}
