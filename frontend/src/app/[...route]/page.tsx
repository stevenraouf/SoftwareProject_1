import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { WindowHome } from "@/components/home";
import { Account } from "@/components/account";
import { VerifyEmail } from "@/components/verify-email";
import {
  publicMetadata,
  readPublicContent,
  readPublicListing,
} from "@/lib/public-discovery";
import {
  discoveryList,
  searchFromValues,
  type SearchValues,
} from "@/lib/discovery-list";
import { places } from "@/lib/destinations";
import BookingFeature from "@/features/booking";
import DiscoveryFeature from "@/features/discovery";
import StaffFeature from "@/features/staff";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ route: string[] }>;
  searchParams: Promise<SearchValues>;
}

export async function generateMetadata({
  params,
  searchParams,
}: RouteProps): Promise<Metadata> {
  const { route } = await params;
  const flightDraft = route.length === 3 && route[0] === "explore" && route[2] === "flights";
  if (route.length > 2 && !flightDraft) notFound();
  const [view, id] = route;
  if (id && ["post", "author", "itinerary"].includes(view))
    return publicMetadata(await readPublicContent(view, id));
  if (view === "explore" && id) {
    const place = places.find(([code]) => code === id.toUpperCase());
    if (!place) return { robots: { index: false, follow: false } };
    const [code, country, city, , , airport] = place;
    return {
      title: (flightDraft ? "Flights to " : "Explore ") + city,
      description:
        "Plan a visit to " +
        city +
        ", " +
        country +
        ". Find flights to " +
        airport +
        " (" +
        code +
        ") and stays in the city.",
    };
  }
  if (!id && (view === "journal" || view === "planner")) {
    const search = searchFromValues(await searchParams);
    const { tab } = discoveryList(view, search);
    if (tab !== "public") return { robots: { index: false, follow: false } };
    return view === "journal"
      ? {
          title: "Travel journal",
          description:
            "Read published travel stories and search the journal by author, keyword or tag.",
        }
      : {
          title: "Public itineraries",
          description:
            "Find public travel itineraries by city, country or trip length and explore their day-by-day plans.",
        };
  }
  if (view === "flights" && !id)
    return {
      title: "Search flights",
      description:
        "Compare flights by departure, arrival, cabin, fare and travel dates.",
    };
  if (view === "stays" && !id)
    return {
      title: "Search stays",
      description:
        "Find hotels and available rooms by destination, stay dates, nightly rate and guest rating.",
    };
  return view === "verify-email" || view === "reset"
    ? { referrer: "no-referrer", robots: { index: false, follow: false } }
    : {};
}

export default async function Page({ params, searchParams }: RouteProps) {
  const route = (await params).route;
  const [view, id] = route;
  const flightDraft = route.length === 3 && view === "explore" && route[2] === "flights";
  if (route.length > 2 && !flightDraft) notFound();
  let content;
  if (view === "explore" && id) {
    if (!places.some(([code]) => code === id.toUpperCase())) notFound();
    content = <WindowHome key={route.join("/")} destination={id} flightDraft={flightDraft} today={new Date().toISOString().slice(0, 10)}
      initialQuery={searchFromValues(await searchParams).toString()} />;
  }
  else if (
    [
      "flights",
      "stays",
      "flight",
      "hotel",
      "trips",
      "booking",
      "change",
    ].includes(view)
  )
    content = <BookingFeature view={view} id={id} />;
  else if (id && ["itinerary", "post", "author"].includes(view)) {
    const initial = await readPublicContent(view, id);
    if (!initial) {
      // Owners can open drafts and private plans at the same URL. Only the
      // authenticated browser API can authorize that view.
      const session = await cookies();
      if (
        view === "author" ||
        !(session.has("access_token") || session.has("refresh_token"))
      )
        notFound();
    }
    content = <DiscoveryFeature view={view} id={id} initial={initial} />;
  } else if (!id && (view === "journal" || view === "planner")) {
    const listing = await readPublicListing(
      view,
      searchFromValues(await searchParams),
    );
    content = <DiscoveryFeature view={view} listing={listing} />;
  } else if (
    ["journal", "planner", "itinerary", "post", "author"].includes(view)
  )
    content = <DiscoveryFeature view={view} id={id} />;
  else if (view === "verify-email" && !id) content = <VerifyEmail />;
  else if (view === "workspace") content = <StaffFeature view={view} id={id} />;
  else if (
    [
      "login",
      "register",
      "account",
      "forgot",
      "reset",
      "password",
      "notifications",
      "favourites",
    ].includes(view)
  )
    content = <Account key={view} view={view} />;
  else if (view === "credits")
    content = (
      <main className="wrap content narrow">
        <h1>Photography credits</h1>
        <p>
          The eight window views use photographs from Wikimedia Commons. The
          cabin surround and cloud layers were created for AERIS.
        </p>
        <a className="button" href="/art/CREDITS.md">
          Read the full credits and licenses
        </a>
      </main>
    );
  else if (view === "terms")
    content = (
      <main className="wrap content narrow">
        <h1>Terms &amp; privacy</h1>
        <article className="panel stack">
          <h2>About this platform</h2>
          <p>
            AERIS is a university travel-planning project. The checkout uses
            Stripe test mode. Use test traveler details when demonstrating a
            booking.
          </p>
          <h2>Your account and bookings</h2>
          <p>
            The service stores account details, traveler information, booking
            snapshots, and policy acceptance to manage reservations. The payment
            form is provided by Stripe. Provider staff can review bookings for
            their assigned provider and administrators can inspect reservations.
          </p>
          <h2>Sharing your trips</h2>
          <p>
            Public itineraries, published posts and their comments are visible
            to visitors. Keep personal details out of public content. You can
            manage your profile, privacy and account from the account page.
          </p>
        </article>
      </main>
    );
  else if (view === "help")
    content = (
      <main className="wrap content narrow">
        <h1>Travel help</h1>
        <div className="panel stack">
          <h2>Where is my ticket?</h2>
          <p>
            Open a confirmed reservation in <Link href="/trips">My trips</Link>{" "}
            to view the ticket and seat choices.
          </p>
          <h2>My payment is processing</h2>
          <p>
            Return to your booking to see the latest status. Keep your booking
            reference while Stripe confirms the payment.
          </p>
          <h2>Changing plans</h2>
          <p>
            Open a reservation to see the cancellation policy and refund quote
            before confirming a cancellation.
          </p>
        </div>
      </main>
    );
  else notFound();
  return (
    <Suspense
      fallback={
        <p className="wrap content" role="status">
          Opening your trip…
        </p>
      }
    >
      {content}
    </Suspense>
  );
}
