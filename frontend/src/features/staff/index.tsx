"use client";

import Link from "next/link";
import { useWorkspaceSection } from "./ui";
import { useSession } from "@/lib/session";
import { AdminWorkspace } from "./admin";
import { Flights } from "./airline";
import { Availability, Reservations, Reviews, Rooms } from "./hotel";
import { Policies, ProviderForm, ProviderMedia } from "./provider";
import {
  Problem,
  Provider,
  Section,
  Tabs,
  useResource,
  useRevision,
} from "./ui";
import "./staff.css";

const hotelTabs = [
  "Overview",
  "Property",
  "Rooms",
  "Availability",
  "Policies",
  "Reservations",
  "Reviews",
];
const airlineTabs = ["Overview", "Airline", "Flights", "Policies", "Manifests"];
function Assignment({ id, hotel }: { id: string; hotel: boolean }) {
  const [tab, setTab] = useWorkspaceSection(hotel ? hotelTabs : airlineTabs),
    [revision, refresh] = useRevision();
  const {
    data: p,
    loading,
    error,
  } = useResource<Provider>((hotel ? "/hotels/" : "/airlines/") + id, revision);
  const items = hotel ? hotelTabs : airlineTabs;
  return (
    <>
      <header className="staffHeading">
        <p className="eyebrow">
          {hotel ? "Hotel operations" : "Airline operations"}
        </p>
        <h1>{p?.name || "Provider workspace"}</h1>
        {p && (
          <p>
            {hotel
              ? [p.address, p.timezone].filter(Boolean).join(" · ")
              : p.code}{" "}
            · {p.active ? "Active provider" : "Inactive provider"}
          </p>
        )}
      </header>
      <Tabs items={items} current={tab} choose={setTab} />
      <Problem>{error}</Problem>
      {loading && <p role="status">Loading assigned provider…</p>}
      {p &&
        (tab === "Overview" ? (
          <div className="staffMetrics">
            {(hotel
              ? [
                  ["Inventory", "Rooms", "Manage rooms and nightly prices"],
                  [
                    "Calendar",
                    "Availability",
                    "Inspect bookable and blocked nights",
                  ],
                  [
                    "Guests",
                    "Reservations",
                    "See reservations and guest names",
                  ],
                ]
              : [
                  ["Schedule", "Flights", "Manage flights, seats and fares"],
                  [
                    "Passengers",
                    "Manifests",
                    "Inspect bookings and export passenger lists",
                  ],
                  [
                    "Terms",
                    "Policies",
                    "Manage cancellation and baggage rules",
                  ],
                ]
            ).map(([name, dest, sub]) => (
              <button
                key={dest}
                className="staffMetric"
                onClick={() => setTab(dest)}
              >
                <span>{name}</span>
                <strong>{dest}</strong>
                <span>{sub} →</span>
              </button>
            ))}
          </div>
        ) : tab === "Property" || tab === "Airline" ? (
          <div className="stack">
            <Section title={hotel ? "Property profile" : "Carrier profile"}>
              <ProviderForm type={p.type} provider={p} after={refresh} />
            </Section>
            <ProviderMedia provider={p} refresh={refresh} />
          </div>
        ) : tab === "Policies" ? (
          <Policies provider={p} refresh={refresh} />
        ) : tab === "Flights" || tab === "Manifests" ? (
          <Flights key={tab} provider={p} manifest={tab === "Manifests"} />
        ) : tab === "Rooms" ? (
          <Rooms id={id} />
        ) : tab === "Availability" ? (
          <Availability id={id} />
        ) : tab === "Reservations" ? (
          <Reservations id={id} />
        ) : (
          <Reviews id={id} />
        ))}
    </>
  );
}
export default function StaffFeature(_props: { view: string; id?: string }) {
  const { user, loading, error } = useSession();
  if (loading) return <p role="status">Opening workspace…</p>;
  if (error) return <Problem>{error}</Problem>;
  if (!user)
    return (
      <section className="panel">
        <h1>Staff sign-in</h1>
        <Link className="button" href="/login?next=%2Fworkspace">
          Sign in
        </Link>
      </section>
    );
  if (user.forcePasswordChange)
    return (
      <section className="panel">
        <h1>Update your temporary password</h1>
        <Link className="button" href="/password">
          Change password
        </Link>
      </section>
    );
  if (user.role === "User")
    return (
      <section className="panel">
        <h1>Your traveler account</h1>
        <Link className="button" href="/trips">
          Open my trips
        </Link>
      </section>
    );
  return (
    <div className="staffWorkspace">
      {user.role === "Admin" ? (
        <AdminWorkspace />
      ) : user.providerId ? (
        <Assignment
          key={user.providerId}
          id={user.providerId}
          hotel={user.role === "HotelModerator"}
        />
      ) : (
        <Problem>
          This account has no assigned provider. Contact the platform
          administrator.
        </Problem>
      )}
    </div>
  );
}
