import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { WindowHome } from "@/components/home";
import { Account } from "@/components/account";
import { VerifyEmail } from "@/components/verify-email";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ route: string[] }>;
}): Promise<Metadata> {
  const [view] = (await params).route;
  return view === "verify-email" || view === "reset"
    ? { referrer: "no-referrer", robots: { index: false, follow: false } }
    : {};
}

import BookingFeature from "@/features/booking";
import DiscoveryFeature from "@/features/discovery";
import StaffFeature from "@/features/staff";

export default async function Page({
  params,
}: {
  params: Promise<{ route: string[] }>;
}) {
  const route = (await params).route;
  const [view, id] = route;
  if (route.length > 2) notFound();
  let content;
  if (view === "explore" && id) content = <WindowHome destination={id} />;
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
  else if (["journal", "planner", "itinerary", "post", "author"].includes(view))
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
