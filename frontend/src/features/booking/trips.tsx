"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { api, apiUrl } from "@/lib/api";
import { findPlace } from "@/lib/destinations";
import { Checkout } from "./payment";
import { StayReview } from "./stays";
import {
  atAirport,
  ErrorLine,
  Field,
  formData,
  localTime,
  money,
  PagedRows,
  Pager,
  qs,
  SignIn,
  Status,
  submit,
  ticketLink,
  useAction,
  useAirports,
  useLoad,
  type Booking,
  type Fare,
  type Page,
  type Passenger,
  type Policy,
  type Segment,
  type Snapshot,
  type Refund,
} from "./shared";

function ItinerarySummary({ s, currency }: { s: Snapshot; currency: string }) {
  return (
    <div className="stack">
      {s.segments?.map((l) => (
        <article className="travel-leg" key={l.flightId}>
          <p className="muted">
            {l.airlineName} · {l.flightNumber} · {l.cabin}
          </p>
          <h3>
            {l.departureAirport} → {l.arrivalAirport}
          </h3>
          <p>
            {localTime(l.departureAt, l.departureZone)} ({l.departureZone}) →{" "}
            {localTime(l.arrivalAt, l.arrivalZone)} ({l.arrivalZone})
          </p>
          <p>
            {l.freeBags} checked bags · {l.bagWeightKg} kg per bag ·{" "}
            {money(l.total, currency)} for this leg
          </p>
        </article>
      ))}
      <PagedRows label="Passenger summary pages">
        {s.passengers?.map((p, i) => (
          <p key={i}>
            <strong>{p.fullName}</strong> · {p.type} · {p.extraBags} extra bags
          </p>
        ))}
      </PagedRows>
      {s.hotelName && (
        <>
          <h3>{s.hotelName}</h3>
          <p>
            {s.checkIn} to {s.checkOut} · {s.timezone}
          </p>
          <PagedRows label="Reserved room pages">
            {s.rooms?.map((r) => (
              <p key={r.roomId}>
                <strong>
                  {r.type} · Room {r.number}
                </strong>
                <br />
                {r.guests
                  .map((g) => g.name + " (" + g.age + ")")
                  .join(", ")} · {money(r.total, currency)}
              </p>
            ))}
          </PagedRows>
        </>
      )}
    </div>
  );
}
export function MyTrips() {
  const q = useSearchParams(),
    router = useRouter(),
    type = q.get("type") === "hotel" ? "hotel" : "flight",
    group = ["Upcoming", "Past", "Cancelled"].includes(q.get("group") || "")
      ? q.get("group")!
      : "Upcoming",
    page = Math.max(1, Number(q.get("page")) || 1);
  const list = useLoad<Page<Booking>>(
      "/" + type + "-bookings?" + qs({ group, page }),
    ),
    me = useLoad<{ role: string }>("/auth/me");
  function go(t: string, g: string, n = 1) {
    router.push("/trips?" + qs({ type: t, group: g, page: n }));
  }
  return (
    <main className="booking-view stack">
      <header>
        <p className="eyebrow">Travel wallet</p>
        <h1>My trips</h1>
      </header>
      <div className="actions">
        {["flight", "hotel"].map((t) => (
          <button
            key={t}
            className={t === type ? "button" : "secondary"}
            aria-pressed={type === t}
            onClick={() => go(t, group)}
          >
            {t === "hotel" ? "Hotel reservations" : "Flight bookings"}
          </button>
        ))}
      </div>
      <div className="actions">
        {["Upcoming", "Past", "Cancelled"].map((g) => (
          <button
            className="secondary"
            key={g}
            aria-pressed={group === g}
            onClick={() => go(type, g)}
          >
            {g}
          </button>
        ))}
      </div>
      {me.error ? (
        <SignIn label="Sign in to see your trips" />
      ) : (
        <Status state={list} />
      )}{" "}
      {list.data?.items.map((b) => (
        <article className="panel fare-row" key={b._id}>
          <div>
            <p className="muted">
              {b.status} · {b.reference || "Awaiting confirmation"}
            </p>
            <h2>
              {b.type === "hotel"
                ? b.snapshot.hotelName
                : b.snapshot.segments
                    ?.map((s) => s.departureAirport + " → " + s.arrivalAirport)
                    .join(" / ")}
            </h2>
            {b.type === "hotel" ? (
              <p>
                {b.snapshot.checkIn} – {b.snapshot.checkOut} ·{" "}
                {b.snapshot.rooms
                  ?.map(
                    (r) =>
                      "Room " +
                      r.number +
                      " · " +
                      r.guests.map((g) => g.name).join(", "),
                  )
                  .join(" / ")}
              </p>
            ) : (
              <p>
                {b.snapshot.segments
                  ?.map(
                    (s) =>
                      s.flightNumber +
                      " · " +
                      s.cabin +
                      " · " +
                      localTime(s.departureAt, s.departureZone),
                  )
                  .join(" / ")}
                <br />
                {b.snapshot.passengers?.map((p) => p.fullName).join(", ")}
              </p>
            )}
          </div>
          <div>
            <strong>{money(b.amount, b.currency)}</strong>
            <p>
              <Link className="button" href={ticketLink(b._id, type)}>
                View booking →
              </Link>
            </p>
          </div>
        </article>
      ))}
      {list.data?.total === 0 && (
        <p className="panel">
          No {group.toLowerCase()} {type === "flight" ? "flights" : "stays"}.
        </p>
      )}
      {list.data && (
        <Pager
          page={page}
          pages={list.data.pages}
          onPage={(n) => go(type, group, n)}
        />
      )}
    </main>
  );
}
type Seat = {
  label: string;
  available: boolean;
  selected: boolean;
  passengerIndex?: number;
};
type SeatMap = { flightId: string; cabin: string; seats: Seat[] };
function seatPosition(label: string) {
  const letter = label.slice(-1);
  if (["A", "F"].includes(letter)) return "Window";
  if (["C", "D"].includes(letter)) return "Aisle";
  return "Middle";
}
function SeatPicker({
  map,
  passengers,
  segment,
  canEdit,
  id,
  onSaved,
  initialPassenger,
  onCancel,
}: {
  map: SeatMap;
  passengers: Passenger[];
  segment: Segment;
  canEdit: boolean;
  id: string;
  onSaved: () => void;
  initialPassenger?: number;
  onCancel?: () => void;
}) {
  const [editing, setEditing] = useState(initialPassenger !== undefined),
    [listView, setListView] = useState(false),
    [chosen, select] = useState<Record<number, string>>(() =>
      Object.fromEntries(
        map.seats
          .filter((s) => s.selected && s.passengerIndex !== undefined)
          .map((s) => [s.passengerIndex, s.label]),
      ),
    ),
    [active, setActive] = useState(initialPassenger ?? 0),
    action = useAction();
  const seated = passengers
    .map((p, i) => ({ p, i }))
    .filter((row) => row.p.type !== "infant");
  const assignment = (i: number) =>
    map.seats.find((s) => s.passengerIndex === i && s.selected)?.label;
  return (
    <article className="travel-leg stack">
      <h3>
        {segment.flightNumber} · {segment.departureAirport} →{" "}
        {segment.arrivalAirport}
      </h3>
      <PagedRows label="Passenger seat assignment pages">
        {passengers.map((p, i) => (
          <p key={i}>
            {p.fullName} ·{" "}
            <strong>
              {p.type === "infant"
                ? "Adult’s lap"
                : assignment(i) || "Seat unassigned"}
            </strong>
          </p>
        ))}
      </PagedRows>
      {canEdit && !editing && (
        <button
          className="secondary"
          onClick={() => {
            select(
              Object.fromEntries(
                seated.map(({ i }) => [i, assignment(i) || ""]),
              ),
            );
            setActive(seated[0]?.i || 0);
            setListView(false);
            setEditing(true);
          }}
        >
          Choose or change seats
        </button>
      )}
      {editing && (
        <div className="stack">
          <Field label="Select a passenger">
            <select
              value={active}
              onChange={(e) => setActive(Number(e.target.value))}
            >
              {seated.map(({ p, i }) => (
                <option key={i} value={i}>
                  {p.fullName} · {chosen[i] || "Choose a seat"}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="secondary"
            onClick={() => setListView(!listView)}
          >
            {listView ? "Show seat map" : "Use accessible seat list"}
          </button>
          <p>{listView ? "Available seats" : "Window A/F · Aisle C/D"}</p>
          <div className={listView ? "seat-list" : "seat-map"}>
            {map.seats
              .filter((seat) => !listView || seat.available)
              .map((s) => (
                <button
                  aria-label={
                    "Seat " +
                    s.label +
                    (listView ? " · " + seatPosition(s.label) : "") +
                    (s.available ? "" : " unavailable")
                  }
                  type="button"
                  key={s.label}
                  aria-pressed={chosen[active] === s.label}
                  disabled={!s.available}
                  onClick={() => {
                    const updated = { ...chosen };
                    for (const key in updated)
                      if (updated[key] === s.label) updated[key] = "";
                    select({ ...updated, [active]: s.label });
                  }}
                >
                  {s.label}
                  {listView && <span>{seatPosition(s.label)}</span>}
                </button>
              ))}
          </div>
          <p>
            {seated
              .map(
                ({ p, i }) => p.fullName + " · " + (chosen[i] || "unassigned"),
              )
              .join(" / ")}
          </p>
          <div className="actions">
            <button
              className="button"
              disabled={action.busy || seated.some(({ i }) => !chosen[i])}
              onClick={() =>
                action.run(async () => {
                  await api("/flight-bookings/" + id + "/seat", {
                    method: "PATCH",
                    body: {
                      flightId: map.flightId,
                      labels: seated.map(({ i }) => chosen[i]),
                    },
                  });
                  setEditing(false);
                  onSaved();
                })
              }
            >
              Save seats
            </button>
            <button
              className="secondary"
              onClick={() => (onCancel ? onCancel() : setEditing(false))}
            >
              {onCancel ? "Cancel" : "Close"}
            </button>
          </div>
          <ErrorLine text={action.error} />
        </div>
      )}
    </article>
  );
}
function Seats({ b }: { b: Booking }) {
  const [version, reload] = useState(0),
    maps = useLoad<SeatMap[]>("/flight-bookings/" + b._id + "/seats", version);
  return (
    <section className="panel stack">
      <h2>Seat assignments</h2>
      <Status state={maps} />
      {maps.data?.map((m) => {
        const segment = b.snapshot.segments?.find(
          (s) => s.flightId === m.flightId,
        );
        return (
          segment && (
            <SeatPicker
              key={m.flightId}
              map={m}
              passengers={b.snapshot.passengers || []}
              segment={segment}
              id={b._id}
              canEdit={
                b.status === "Confirmed" && Date.parse(b.startsAt) > Date.now()
              }
              onSaved={() => reload((v) => v + 1)}
            />
          )
        );
      })}
    </section>
  );
}
function Cancellation({ b, after }: { b: Booking; after: () => void }) {
  const [quote, set] = useState<{
      amount: number;
      percentage: number;
      currency: string;
    } | null>(null),
    action = useAction(),
    base = "/" + b.type + "-bookings/" + b._id;
  return (
    <section className="panel stack">
      <h2>Cancellation</h2>
      {quote ? (
        <>
          <p>
            The refund for this entire booking is{" "}
            {money(quote.amount, quote.currency)} ({quote.percentage}%).
          </p>
          <div className="actions">
            <button
              className="secondary"
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  await api(base + "/cancel", {
                    method: "POST",
                    body: { confirm: true },
                  });
                  after();
                })
              }
            >
              Confirm cancellation
            </button>
            <button className="button" onClick={() => set(null)}>
              Keep booking
            </button>
          </div>
        </>
      ) : (
        <button
          className="secondary"
          disabled={action.busy}
          onClick={() =>
            action.run(async () => set(await api(base + "/cancellation-quote")))
          }
        >
          Preview cancellation refund
        </button>
      )}
      <ErrorLine text={action.error} />
    </section>
  );
}
function RefundRow({ r }: { r: Refund }) {
  const [version, set] = useState(0),
    state = useLoad<Refund>("/refunds/" + r._id, version),
    refund = state.data || r;
  return (
    <div>
      <p>
        {refund.reason} · {money(refund.amount, refund.currency)} ·{" "}
        {refund.status}
      </p>
      <button className="secondary" onClick={() => set((v) => v + 1)}>
        Refresh refund status
      </button>
      <ErrorLine text={state.error} />
    </div>
  );
}
function FlightTicket({
  b,
  bookingUrl,
  pdfUrl,
}: {
  b: Booking;
  bookingUrl: string;
  pdfUrl: string;
}) {
  const router = useRouter(),
    query = useSearchParams(),
    airports = useAirports();
  const [version, refresh] = useState(0);
  const maps = useLoad<SeatMap[]>(
    "/flight-bookings/" + b._id + "/seats",
    version,
  );
  const segments = b.snapshot.segments || [],
    passengers = b.snapshot.passengers || [];
  const ticketUrl = bookingUrl + "&view=ticket";
  const editable =
    b.status === "Confirmed" && Date.parse(b.startsAt) > Date.now();
  const carrierNames = [
    ...new Set(segments.map((s) => s.airlineName).filter(Boolean)),
  ].join(" / ");
  const selectedFlight = query.get("seatFlight");
  const passengerIndex = Number(query.get("seatPassenger"));
  const changing = segments.find((s) => s.flightId === selectedFlight);
  const changingMap = maps.data?.find(
    (m) => m.flightId === selectedFlight && m.cabin === changing?.cabin,
  );
  if (
    editable &&
    changing &&
    changingMap &&
    query.has("seatPassenger") &&
    passengers[passengerIndex] &&
    passengers[passengerIndex].type !== "infant"
  ) {
    return (
      <main className="booking-view stack">
        <header>
          <p className="eyebrow">Confirmed booking</p>
          <h1>Choose your seat</h1>
        </header>
        <SeatPicker
          key={changing.flightId + "-" + passengerIndex}
          map={changingMap}
          passengers={passengers}
          segment={changing}
          canEdit
          id={b._id}
          initialPassenger={passengerIndex}
          onCancel={() => router.replace(ticketUrl)}
          onSaved={() => {
            refresh((i) => i + 1);
            router.replace(ticketUrl);
          }}
        />
      </main>
    );
  }
  return (
    <main className="booking-view stack ticket-preview">
      <ol className="ticket-steps" aria-label="Booking stages">
        {["Flight", "Travelers", "Review", "Payment", "Booking"].map(
          (stage) => (
            <li
              key={stage}
              aria-current={stage === "Booking" ? "step" : undefined}
            >
              {stage}
            </li>
          ),
        )}
      </ol>
      <header>
        <p className="eyebrow">E-ticket / Document preview</p>
        <h1 className="glass">Flight e-ticket</h1>
        <p>
          {[
            carrierNames,
            segments.length === 1
              ? "One-way flight"
              : segments.length === 2
                ? "Round-trip flight"
                : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      {maps.error && <ErrorLine text={maps.error} />}
      {segments.map((s, leg) => {
        const map = maps.data?.find(
          (m) => m.flightId === s.flightId && m.cabin === s.cabin,
        );
        const assigned = new Map(
          map?.seats
            .filter((seat) => seat.selected)
            .map((seat) => [seat.passengerIndex, seat.label]),
        );
        const endpoints = [
          {
            code: s.departureAirport,
            instant: s.departureAt,
            zone: s.departureZone,
          },
          { code: s.arrivalAirport, instant: s.arrivalAt, zone: s.arrivalZone },
        ].map((end) => {
          const airport = airports.find((a) => a.iata_code === end.code);
          const city =
            findPlace(end.code)?.[2] ||
            airport?.city_id
              ?.replace(/[-_]/g, " ")
              .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
          const zone = end.zone || airport?.time_zone || "UTC";
          const time = new Date(end.instant);
          return {
            ...end,
            city,
            zone,
            localTime: time.toLocaleTimeString("en-GB", {
              timeZone: zone,
              hour: "2-digit",
              minute: "2-digit",
            }),
            date: time.toLocaleDateString("en-GB", {
              timeZone: zone,
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          };
        });
        const minutes = Math.round(
          (Date.parse(s.arrivalAt) - Date.parse(s.departureAt)) / 60000,
        );
        return (
          <article
            className="ticket-document"
            aria-label={"Flight e-ticket document · " + s.flightNumber}
            key={s.flightId}
          >
            <header className="ticket-carrier">
              <p>{[s.airlineName, s.cabin].filter(Boolean).join("　/　")}</p>
              <h2>
                {s.departureAirport} → {s.arrivalAirport}
              </h2>
            </header>
            <div className="ticket-paper">
              <div className="ticket-route">
                {endpoints.map((end, i) => (
                  <div className={"ticket-stop ticket-stop-" + i} key={i}>
                    <time
                      dateTime={end.instant}
                      aria-label={
                        (i ? "Arrival " : "Departure ") + end.localTime
                      }
                    >
                      {end.localTime}
                    </time>
                    <span>
                      {[end.code, end.city].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ))}
                <div className="ticket-duration" aria-label="Flight duration">
                  {Math.floor(minutes / 60)}h{" "}
                  {String(minutes % 60).padStart(2, "0")}m
                  <span aria-hidden="true" />
                </div>
              </div>
              <PagedRows label={"Ticket passengers for " + s.flightNumber}>
                {passengers.map((p, i) => (
                  <dl className="ticket-fields ticket-traveler" key={i}>
                    <dt>Passenger</dt>
                    <dd>
                      {p.fullName} · {p.type}
                    </dd>
                    <dt>Seat</dt>
                    <dd className="ticket-seat">
                      <strong>
                        {p.type === "infant"
                          ? "Adult’s lap"
                          : assigned.get(i) ||
                            (map
                              ? "Not assigned"
                              : maps.error || maps.data
                                ? "Unavailable"
                                : "Loading…")}
                      </strong>
                      {editable && map && p.type !== "infant" && (
                        <Link
                          href={
                            ticketUrl +
                            "&" +
                            qs({ seatFlight: s.flightId, seatPassenger: i })
                          }
                        >
                          {assigned.has(i) ? "Change seat" : "Choose a seat"}
                        </Link>
                      )}
                    </dd>
                    {passengers.length > 1 && (
                      <>
                        <dt>Extra bags</dt>
                        <dd>{p.extraBags ?? 0}</dd>
                      </>
                    )}
                  </dl>
                ))}
              </PagedRows>
              <dl className="ticket-fields">
                <dt>Flight</dt>
                <dd>{s.flightNumber}</dd>
                <dt>Date</dt>
                <dd>{endpoints[0].date}</dd>
                {endpoints[1].date !== endpoints[0].date && (
                  <>
                    <dt>Arrival date</dt>
                    <dd>{endpoints[1].date}</dd>
                  </>
                )}
                {passengers.length === 1 && (
                  <>
                    <dt>Extra bags</dt>
                    <dd>{passengers[0].extraBags ?? 0}</dd>
                  </>
                )}
                {segments.length > 1 && (
                  <>
                    <dt>Fare for this leg</dt>
                    <dd>{money(s.total, b.currency)}</dd>
                  </>
                )}
                {leg === segments.length - 1 && (
                  <>
                    <dt>
                      {segments.length > 1
                        ? "Booking total paid"
                        : "Total paid"}
                    </dt>
                    <dd>{money(b.amount, b.currency)}</dd>
                  </>
                )}
              </dl>
              <footer>
                <p>
                  {endpoints
                    .map((end) => end.code + " · " + end.zone)
                    .join("　/　")}
                </p>
                <p>Booking reference: {b.reference}</p>
              </footer>
            </div>
          </article>
        );
      })}
      <div className="actions">
        <Link className="button secondary" href={bookingUrl}>
          ← Back to booking
        </Link>
        <a className="button" href={pdfUrl} target="_blank" rel="noreferrer">
          Download e-ticket PDF
        </a>
      </div>
    </main>
  );
}

export function BookingDetail({ id }: { id: string }) {
  const q = useSearchParams(),
    type = q.get("type") === "hotel" ? "hotel" : "flight",
    [version, reload] = useState(0),
    item = useLoad<Booking>("/" + type + "-bookings/" + id, version),
    changed = useCallback(() => reload((v) => v + 1), []);
  if (!item.data)
    return (
      <main className="booking-view">
        <Status state={item} />
        {item.error && <Link href="/trips">My trips</Link>}
      </main>
    );
  const b = item.data,
    ticket = type === "flight" && ["Confirmed", "Completed"].includes(b.status);
  const bookingUrl = ticketLink(id, type);
  const pdfUrl = apiUrl("/flight-bookings/" + id + "/e-ticket");
  if (ticket && q.get("view") === "ticket")
    return <FlightTicket b={b} bookingUrl={bookingUrl} pdfUrl={pdfUrl} />;
  return (
    <main className="booking-view stack">
      <Link href={"/trips?type=" + type}>← My trips</Link>
      <header>
        <p className="eyebrow">{b.status}</p>
        <h1>{type === "hotel" ? "Your reservation" : "Your flight booking"}</h1>
        {b.reference && (
          <p>
            Booking reference <strong>{b.reference}</strong>
          </p>
        )}
      </header>
      <section className="panel stack">
        <ItinerarySummary s={b.snapshot} currency={b.currency} />
        <strong>Total {money(b.amount, b.currency)}</strong>
      </section>
      {b.status === "Pending Payment" && b.holdExpiresAt && (
        <Checkout
          id={id}
          type={type}
          currency={b.currency}
          expires={b.holdExpiresAt}
          existingPayment={b.paymentId}
          onChanged={changed}
        />
      )}
      {ticket && (
        <>
          <Link className="button" href={bookingUrl + "&view=ticket"}>
            View e-ticket
          </Link>
          <div id="seat-assignments">
            <Seats b={b} />
          </div>
        </>
      )}
      {b.status === "Confirmed" && Date.parse(b.startsAt) > Date.now() && (
        <>
          {type === "flight" &&
            (b.pendingChangeId ? (
              <Link className="button" href={"/change/" + b.pendingChangeId}>
                Resume pending flight change
              </Link>
            ) : (
              <Replacement b={b} />
            ))}
          <Cancellation b={b} after={changed} />
        </>
      )}
      {b.refunds && b.refunds.length > 0 && (
        <section className="panel">
          <h2>Refunds</h2>
          <PagedRows label="Refund pages">
            {b.refunds.map((r) => (
              <RefundRow key={r._id} r={r} />
            ))}
          </PagedRows>
        </section>
      )}
      {type === "hotel" && b.status === "Completed" && (
        <StayReview booking={b} />
      )}
      {b.status === "Expired" && (
        <p className="notice">
          This hold has expired.{" "}
          <Link href={type === "flight" ? "/flights" : "/stays"}>
            Search again
          </Link>
        </p>
      )}
    </main>
  );
}
function LegChange({
  s,
  passengers,
  onSelect,
}: {
  s: Segment;
  passengers: Passenger[];
  onSelect: (id: string) => void;
}) {
  const [date, setDate] = useState(""),
    [page, setPage] = useState(1);
  const counts = {
    adults: passengers.filter((p) => p.type === "adult").length,
    children: passengers.filter((p) => p.type === "child").length,
    infants: passengers.filter((p) => p.type === "infant").length,
  };
  const res = useLoad<Page<Fare>>(
    date
      ? "/flights/search?" +
          qs({
            departureAirport: s.departureAirport,
            arrivalAirport: s.arrivalAirport,
            departureDate: date,
            cabin: s.cabin,
            ...counts,
            page,
          })
      : null,
  );
  return (
    <div className="stack">
      <Field
        label={
          "New departure · " + s.departureAirport + " → " + s.arrivalAirport
        }
      >
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
            onSelect("");
          }}
        />
      </Field>
      {date && <Status state={res} />}{" "}
      {res.data && (
        <>
          <Field label={"Replacement " + s.cabin + " flight"}>
            <select
              key={date + page}
              defaultValue=""
              onChange={(e) => onSelect(e.target.value)}
            >
              <option value="">Select a flight</option>
              {res.data.items
                .filter((f) => f.flightId !== s.flightId)
                .map((f) => (
                  <option key={f.flightId} value={f.flightId}>
                    {f.flightNumber} · {atAirport(f.departureLocal)} ·{" "}
                    {money(f.price, f.currency)} before extra bags
                  </option>
                ))}
            </select>
          </Field>
          <Pager
            page={page}
            pages={res.data.pages}
            onPage={(p) => {
              setPage(p);
              onSelect("");
            }}
          />
        </>
      )}
    </div>
  );
}
function Replacement({ b }: { b: Booking }) {
  const [choices, set] = useState<Record<number, string>>({}),
    router = useRouter(),
    action = useAction(),
    segments = b.snapshot.segments || [];
  return (
    <details className="panel">
      <summary>Change flights</summary>
      <div className="stack">
        <p>
          Choose replacement flights on the same route and in the same cabin.
          Lower fares create a refund. Higher fares require a separate payment.
        </p>
        {segments.map((s, i) => (
          <LegChange
            key={s.flightId}
            s={s}
            passengers={b.snapshot.passengers || []}
            onSelect={(id) => set((old) => ({ ...old, [i]: id }))}
          />
        ))}
        <button
          className="secondary"
          disabled={action.busy || segments.some((_, i) => !choices[i])}
          onClick={() => {
            if (
              window.confirm(
                "Request these replacement flights? An equal or lower fare updates your booking immediately.",
              )
            )
              action.run(async () => {
                const change = await api<{ _id: string }>(
                  "/flight-bookings/" + b._id + "/change-flight",
                  {
                    method: "PATCH",
                    body: {
                      segments: segments.map((s, i) => ({
                        flightId: choices[i],
                        cabin: s.cabin,
                      })),
                    },
                  },
                );
                router.push("/change/" + change._id);
              });
          }}
        >
          Request flight change
        </button>
        <ErrorLine text={action.error} />
      </div>
    </details>
  );
}
export function ChangeDetail({ id }: { id: string }) {
  const [version, reload] = useState(0),
    res = useLoad<{
      bookingId: string;
      snapshot: Snapshot;
      policySnapshot: Policy;
      status: string;
      difference: number;
      expiresAt: string;
      paymentId?: string;
    }>("/flight-changes/" + id, version),
    changed = useCallback(() => reload((v) => v + 1), []);
  const c = res.data;
  const booking = useLoad<Booking>(
    c ? "/flight-bookings/" + c.bookingId : null,
  );
  return (
    <main className="booking-view stack">
      <header>
        <p className="eyebrow">My trips</p>
        <h1>Flight change</h1>
      </header>
      <Status state={res} />
      {c && <Status state={booking} />}
      {c && booking.data && (
        <>
          <section className="panel stack">
            <p>{c.status}</p>
            <ItinerarySummary s={c.snapshot} currency={booking.data.currency} />
            <strong>
              {c.difference < 0 ? "Refund" : "Additional fare"}{" "}
              {money(Math.abs(c.difference), booking.data.currency)}
            </strong>
          </section>
          {c.status === "Pending Payment" && (
            <Checkout
              id={id}
              type="change"
              currency={booking.data.currency}
              existingPayment={c.paymentId}
              expires={c.expiresAt}
              onChanged={changed}
            />
          )}
          <Link href={ticketLink(c.bookingId, "flight")}>
            Return to booking
          </Link>
        </>
      )}
    </main>
  );
}
