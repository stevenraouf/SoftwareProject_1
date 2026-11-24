"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  Action,
  cash,
  choices,
  Editor,
  LoadState,
  Pager,
  query,
  useResource,
  type Fields,
  type Page,
} from "./shared";
import { findLabel, useRefs, type Plan } from "./planner-data";

interface Hotel {
  _id: string;
  name: string;
  pricePerNight: number;
  currency: string;
}
interface Flight {
  flightId: string;
  flightNumber: string;
  cabin: string;
  price: number;
  currency: string;
  departureLocal: string;
}
type FlightOptions = {
  airport: string;
  results: Page<Flight> | { outbound: Page<Flight>; return: Page<Flight> };
};
interface Booking {
  _id: string;
  reference?: string;
  amount: number;
  currency: string;
  startsAt: string;
  status: string;
}
const followingDay = (date: string) =>
  new Date(Date.parse(date + "T00:00:00.000Z") + 86400000)
    .toISOString()
    .slice(0, 10);

function GroupHotels({ plan }: { plan: Plan }) {
  const refs = useRefs(),
    [criteria, setCriteria] = useState<Fields>(),
    [page, setPage] = useState(1);
  const results = useResource<Page<Hotel>>(
    criteria
      ? "/itineraries/" +
          plan._id +
          "/hotels?" +
          query({ ...criteria, page: String(page) })
      : null,
  );
  const group = plan.cityGroups.find(
    (g) => g.firstDayId === criteria?.firstDayId,
  );
  const params =
    group && criteria
      ? query({
          destination: group.city,
          checkIn: group.firstDate,
          checkOut: followingDay(group.lastDate),
          guests: criteria.guests,
          rooms: criteria.rooms,
        })
      : "";
  return (
    <div>
      <h3>Stays for a city group</h3>
      <Editor
        fields={[
          {
            name: "firstDayId",
            label: "Stay dates and city",
            type: "select",
            required: true,
            options: plan.cityGroups.map((g) => ({
              value: g.firstDayId,
              label:
                findLabel(refs.cities, g.city) +
                " · " +
                g.firstDate +
                " to " +
                followingDay(g.lastDate),
            })),
            initial: plan.cityGroups[0]?.firstDayId,
          },
          {
            name: "guests",
            label: "Guests",
            type: "number",
            min: 1,
            max: 100,
            required: true,
            initial: 1,
          },
          {
            name: "rooms",
            label: "Rooms",
            type: "number",
            min: 1,
            max: 20,
            required: true,
            initial: 1,
          },
        ]}
        action="Find stays"
        onSave={async (v) => {
          setCriteria(v);
          setPage(1);
        }}
      />
      {criteria &&
        (results.data ? (
          <>
            <p>{results.data.total} matching stays</p>
            {results.data.items.map((h) => (
              <p key={h._id}>
                <Link href={"/hotel/" + h._id + "?" + params}>{h.name}</Link> ·
                from {cash(h.pricePerNight, h.currency)} per night
              </p>
            ))}
            <Pager page={page} pages={results.data.pages} go={setPage} />
          </>
        ) : (
          <LoadState error={results.error} retry={results.reload} />
        ))}
    </div>
  );
}

function ArrivalFlights({ plan }: { plan: Plan }) {
  const refs = useRefs(),
    [criteria, setCriteria] = useState<Fields>(),
    [page, setPage] = useState(1);
  const [trip, setTrip] = useState("one-way");
  const results = useResource<FlightOptions[]>(
    criteria
      ? "/itineraries/" +
          plan._id +
          "/flights?" +
          query({ ...criteria, page: String(page) })
      : null,
  );
  return (
    <div>
      <h3>Flights to {findLabel(refs.cities, plan.days[0].city)}</h3>
      <label>
        Trip type{" "}
        <select
          value={trip}
          onChange={(e) => {
            setTrip(e.target.value);
            setCriteria(undefined);
          }}
        >
          <option value="one-way">One way</option>
          <option value="round-trip">Round trip</option>
        </select>
      </label>
      <Editor
        key={trip}
        fields={[
          {
            name: "origin",
            label: "Departure airport",
            type: "select",
            required: true,
            options: refs.airports,
          },
          {
            name: "departureDate",
            label: "Outbound date",
            type: "date",
            initial: plan.startDate,
            required: true,
          },
          ...(trip === "round-trip"
            ? [
                {
                  name: "returnDate",
                  label: "Return date",
                  type: "date" as const,
                  initial: plan.days.at(-1)?.date,
                  required: true,
                },
              ]
            : []),
          {
            name: "adults",
            label: "Adults",
            type: "number",
            min: 1,
            max: 1000,
            required: true,
            initial: 1,
          },
          {
            name: "children",
            label: "Children",
            type: "number",
            min: 0,
            max: 1000,
            initial: 0,
          },
          {
            name: "infants",
            label: "Infants",
            type: "number",
            min: 0,
            max: 1000,
            initial: 0,
          },
        ]}
        action="Find flights"
        onSave={async (v) => {
          setPage(1);
          setCriteria({ ...v, tripType: trip });
        }}
      />
      {criteria &&
        (results.data ? (
          <>
            {!results.data.length && (
              <p>No airports are listed for this city.</p>
            )}
            {results.data.map(({ airport, results: fares }) => {
              const outbound = "outbound" in fares ? fares.outbound : fares,
                inbound = "return" in fares ? fares.return : null;
              const params = query({
                departureAirport: criteria.origin,
                arrivalAirport: airport,
                departureDate: criteria.departureDate,
                returnDate: criteria.returnDate || "",
                adults: criteria.adults,
                children: criteria.children,
                infants: criteria.infants,
              });
              return (
                <article key={airport} className="discovery-item">
                  <strong>{airport}</strong>
                  {[
                    { label: "Outbound", rows: outbound },
                    ...(inbound ? [{ label: "Return", rows: inbound }] : []),
                  ].map(({ label, rows }) => (
                    <div key={label}>
                      <h4>{label} fares</h4>
                      {rows.items.map((f) => (
                        <p key={f.flightId + f.cabin}>
                          {f.flightNumber} · {f.cabin} ·{" "}
                          {f.departureLocal.slice(0, 16).replace("T", " ")}{" "}
                          local · {cash(f.price, f.currency)}
                        </p>
                      ))}
                      {!rows.items.length && <p>No fares on this page.</p>}
                    </div>
                  ))}
                  {outbound.total > 0 && (!inbound || inbound.total > 0) && (
                    <Link href={"/flights?" + params}>
                      Choose your flights →
                    </Link>
                  )}
                </article>
              );
            })}
            <Pager
              page={page}
              pages={Math.max(
                1,
                ...results.data.flatMap((x) =>
                  "outbound" in x.results
                    ? [x.results.outbound.pages, x.results.return.pages]
                    : [x.results.pages],
                ),
              )}
              go={setPage}
            />
          </>
        ) : (
          <LoadState error={results.error} retry={results.reload} />
        ))}
    </div>
  );
}

function BookingLinks({ plan, reload }: { plan: Plan; reload: () => void }) {
  const refs = useRefs();
  const [type, setType] = useState("flight"),
    [status, setStatus] = useState("Confirmed"),
    [page, setPage] = useState(1),
    [day, setDay] = useState(plan.days[0]._id);
  const result = useResource<Page<Booking>>(
    "/" + type + "-bookings?" + query({ status, page: String(page) }),
  );
  const links = plan.bookingLinks || [];
  return (
    <div>
      <h3>Link a booking</h3>
      <div className="discovery-form">
        <label>
          Booking type
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="flight">Flight</option>
            <option value="hotel">Hotel</option>
          </select>
        </label>
        <label>
          Booking status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {choices(["Confirmed", "Completed"]).map((x) => (
              <option key={x.value}>{x.value}</option>
            ))}
          </select>
        </label>
        <label>
          Itinerary day
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {plan.days.map((d) => (
              <option key={d._id} value={d._id}>
                Day {d.number} · {findLabel(refs.cities, d.city)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {result.data ? (
        <>
          <ul className="discovery-list">
            {result.data.items.map((b) => (
              <li key={b._id}>
                <span>
                  {b.reference || b.startsAt?.slice(0, 10)} ·{" "}
                  {cash(b.amount, b.currency)}
                </span>
                {links.some((l) => l.bookingId === b._id) ? (
                  <small>Linked</small>
                ) : (
                  <Action
                    perform={async () => {
                      await api("/itineraries/" + plan._id + "/bookings", {
                        method: "POST",
                        body: { dayId: day, bookingId: b._id },
                      });
                      reload();
                    }}
                  >
                    Link booking
                  </Action>
                )}
              </li>
            ))}
          </ul>
          {!result.data.items.length && (
            <p>
              No {status.toLowerCase()} {type} bookings on this page.
            </p>
          )}
          <Pager page={page} pages={result.data.pages} go={setPage} />
        </>
      ) : (
        <LoadState retry={result.reload} error={result.error} />
      )}
    </div>
  );
}

export function TravelTools({
  plan,
  reload,
}: {
  plan: Plan;
  reload: () => void;
}) {
  const [tab, setTab] = useState("");
  return (
    <section className="panel">
      <h2>Travel for this itinerary</h2>
      <div className="discovery-tabs">
        {[
          ["hotel", "Find stays"],
          ["flight", "Find flights"],
          ["link", "Link a booking"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={tab === id}
            className="secondary"
            onClick={() => setTab(id === tab ? "" : id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "hotel" && <GroupHotels plan={plan} />}{" "}
      {tab === "flight" && <ArrivalFlights plan={plan} />}{" "}
      {tab === "link" && <BookingLinks plan={plan} reload={reload} />}
    </section>
  );
}
