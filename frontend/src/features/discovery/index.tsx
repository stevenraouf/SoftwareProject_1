"use client";

import { Suspense } from "react";
import { useSession } from "@/lib/session";
import {
  AuthorPage,
  Journal,
  StoryPage,
  type Story,
  type StoryRow,
  type AuthorProfile,
} from "./journal";
import { Planner, PlanPage } from "./planner";
import { ReferencesProvider, type Plan, type Row } from "./planner-data";
import type { Page } from "./shared";
import type { InitialList } from "@/lib/discovery-list";
import "./discovery.css";

export type PublicContent =
  | { view: "post"; data: Story }
  | { view: "author"; data: AuthorProfile }
  | { view: "itinerary"; data: Plan };

export type PublicListing =
  | ({ view: "journal" } & InitialList<Page<StoryRow>>)
  | ({ view: "planner" } & InitialList<Page<Row>>);

export default function DiscoveryFeature({
  view,
  id,
  initial,
  listing,
}: {
  view: string;
  id?: string;
  initial?: PublicContent;
  listing?: PublicListing;
}) {
  const { user } = useSession();
  return (
    <main className="discovery" key={[view, id, user?.id].join(":")}>
      <Suspense fallback={<p role="status">Loading…</p>}>
        {view === "journal" ? (
          <Journal
            key={listing?.path}
            initial={listing?.view === "journal" ? listing : undefined}
          />
        ) : view === "post" && id ? (
          <StoryPage
            id={id}
            initial={initial?.view === "post" ? initial.data : undefined}
          />
        ) : view === "author" && id ? (
          <AuthorPage
            id={id}
            initial={initial?.view === "author" ? initial.data : undefined}
          />
        ) : (
          <ReferencesProvider>
            {view === "itinerary" && id ? (
              <PlanPage
                id={id}
                initial={
                  initial?.view === "itinerary" ? initial.data : undefined
                }
              />
            ) : (
              <Planner
                key={listing?.path}
                initial={listing?.view === "planner" ? listing : undefined}
              />
            )}
          </ReferencesProvider>
        )}
      </Suspense>
    </main>
  );
}
