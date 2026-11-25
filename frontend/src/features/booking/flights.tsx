"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  atAirport,
  invalidField,
  cabins,
  ErrorLine,
  Field,
  formData,
  money,
  PagedRows,
  Pager,
  qs,
  SignIn,
  Status,
  submit,
  Tiers,
  ticketLink,
  useAction,
  useAirports,
  useLoad,
  type Booking,
  type Fare,
  type Flight,
  type Page,
  type Passenger,
  type Segment,
} from "./shared";

type Search = Page<Fare> | { outbound: Page<Fare>; return: Page<Fare> };
const searchKeys = [
  "departureAirport",
  "arrivalAirport",
  "departureDate",
  "returnDate",
  "adults",
  "children",
  "infants",
  "cabin",
  "minPrice",
  "maxPrice",
  "sort",
  "page",
];
export function FlightSearch() {
  const query = useSearchParams(),
    router = useRouter(),
    airports = useAirports(),
    [round, setRound] = useState(!!query.get("returnDate"));
  const parameters = Object.fromEntries(
    searchKeys.map((k) => [k, query.get(k) || ""]),
  );
  const queryString = qs(parameters),
    ready = !!(
      parameters.departureAirport &&
      parameters.arrivalAirport &&
      parameters.departureDate
    );
  const result = useLoad<Search>(
    ready ? "/flights/search?" + queryString : null,
  );
  const [selection, select] = useState<{
    key: string;
    out?: Fare;
    back?: Fare;
  }>({ key: "" });
  // Page changes preserve the other leg's selection.
  const selectionKey = qs({ ...parameters, page: "" }),
    chosen = selection.key === selectionKey ? selection : { key: selectionKey };
  const page = Math.max(1, Number(parameters.page) || 1);
  const legPage =
    result.data &&
    ("outbound" in result.data ? result.data.outbound : result.data);
  const backPage =
    result.data && "outbound" in result.data ? result.data.return : undefined;
  const hero = airports.find((a) => a.iata_code === parameters.arrivalAirport);
  function options(title: string, items: Page<Fare>, leg: "out" | "back") {
    return (
      <section className="stack">
        <h2>{title}</h2>
        {items.items.length === 0 && (
          <p className="panel">
            No flights found. Try another date, airport or cabin.
          </p>
        )}
        {items.items.map((f) => (
          <article className="panel fare-row" key={f.flightId + f.cabin}>
            <div>
              <p className="muted">
                {f.flightNumber} · {f.cabin}
              </p>
              <h3>
                {f.departureAirport} → {f.arrivalAirport}
              </h3>
              <p>
                {atAirport(f.departureLocal)} local ·{" "}
                {Math.floor(f.durationMinutes / 60)}h {f.durationMinutes % 60}m
                · {f.seatsRemaining} seats left
              </p>
              <Link
                href={
                  "/flight/" +
                  f.flightId +
                  "?" +
                  qs({ ...parameters, cabin: f.cabin, details: "1" })
                }
              >
                Flight details &amp; baggage
              </Link>
            </div>
            <div>
              <strong>{money(f.price, f.currency)}</strong>
              <p>Party fare · one leg</p>
              <button
                type="button"
                className={
                  chosen[leg]?.flightId === f.flightId &&
                  chosen[leg]?.cabin === f.cabin
                    ? "secondary"
                    : "button"
                }
                aria-pressed={
                  chosen[leg]?.flightId === f.flightId &&
                  chosen[leg]?.cabin === f.cabin
                }
                onClick={() => select({ ...chosen, [leg]: f })}
              >
                {chosen[leg]?.flightId === f.flightId &&
                chosen[leg]?.cabin === f.cabin
                  ? "Selected"
                  : "Select fare"}
              </button>
            </div>
          </article>
        ))}
      </section>
    );
  }
  const next =
    chosen.out && (!parameters.returnDate || chosen.back)
      ? "/flight/" +
        chosen.out.flightId +
        "?" +
        qs({
          ...parameters,
          cabin: chosen.out.cabin,
          back: chosen.back?.flightId,
          backCabin: chosen.back?.cabin,
        })
      : "";
  return (
    <main className="booking-view stack">
      <header>
        <p className="eyebrow">Flights</p>
        <h1>
          {hero
            ? "Flights to " + hero.city_id.replace(/[-_]/g, " ")
            : "Find your flight"}
        </h1>
      </header>
      <form
        key={queryString}
        className="panel stack"
        onSubmit={submit((form) => {
          const values = formData(form);
          if (!round) delete values.returnDate;
          for (const field of ["departureAirport", "arrivalAirport"]) {
            if (
              airports.length &&
              !airports.some((a) => a.iata_code === values[field])
            )
              return invalidField(
                form,
                field,
                "Choose an airport from the airport directory.",
              );
          }
          if (values.departureAirport === values.arrivalAirport)
            return invalidField(
              form,
              "arrivalAirport",
              "Choose a different arrival airport.",
            );
          if (values.returnDate && values.returnDate < values.departureDate)
            return invalidField(
              form,
              "returnDate",
              "Choose a return date on or after departure.",
            );
          if (Number(values.infants) > Number(values.adults))
            return invalidField(
              form,
              "infants",
              "Choose at most one lap infant per adult.",
            );
          if (
            values.minPrice &&
            values.maxPrice &&
            Number(values.maxPrice) < Number(values.minPrice)
          )
            return invalidField(
              form,
              "maxPrice",
              "Maximum fare must be at least the minimum fare.",
            );
          select({ key: "" });
          router.push("/flights?" + qs(values));
        })}
      >
        <div className="actions">
          <label>
            <input
              type="radio"
              checked={!round}
              onChange={() => setRound(false)}
            />{" "}
            One way
          </label>
          <label>
            <input
              type="radio"
              checked={round}
              onChange={() => setRound(true)}
            />{" "}
            Round trip
          </label>
        </div>
        <div className="grid">
          {(["departureAirport", "arrivalAirport"] as const).map((k, i) => (
            <Field key={k} label={i ? "To airport" : "From airport"}>
              <input
                required
                name={k}
                defaultValue={parameters[k] || (i ? "" : "CAI")}
                pattern="[A-Z]{3}"
                title="Enter an official three-letter airport code, such as CAI."
                maxLength={3}
                list="aeris-airports"
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.toUpperCase();
                }}
              />
            </Field>
          ))}
          <datalist id="aeris-airports">
            {airports.map((a) => (
              <option key={a.iata_code} value={a.iata_code}>
                {a.name} · {a.time_zone}
              </option>
            ))}
          </datalist>
          <Field label="Departure date">
            <input
              name="departureDate"
              type="date"
              defaultValue={parameters.departureDate}
              required
            />
          </Field>
          {round && (
            <Field label="Return date">
              <input
                name="returnDate"
                type="date"
                defaultValue={parameters.returnDate}
                required
              />
            </Field>
          )}
        </div>
        <div className="grid">
          {["adults", "children", "infants"].map((k, i) => (
            <Field
              key={k}
              label={
                ["Adults · 12+", "Children · 2–11", "Lap infants · under 2"][i]
              }
            >
              <input
                type="number"
                name={k}
                required
                min={i ? 0 : 1}
                max={1000}
                defaultValue={parameters[k] || (i ? 0 : 1)}
              />
            </Field>
          ))}
          <Field label="Cabin">
            <select name="cabin" defaultValue={parameters.cabin}>
              <option value="">All cabins</option>
              {cabins.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
        </div>
        <details open={!!(parameters.minPrice || parameters.maxPrice)}>
          <summary>Price filters &amp; sorting</summary>
          <div className="grid">
            {["minPrice", "maxPrice"].map((k, i) => (
              <Field
                key={k}
                label={(i ? "Maximum" : "Minimum") + " party fare"}
              >
                <input
                  name={k}
                  type="number"
                  min="0"
                  step=".01"
                  defaultValue={parameters[k]}
                />
              </Field>
            ))}
            <Field label="Sort by">
              <select name="sort" defaultValue={parameters.sort || "price"}>
                <option value="price">Lowest fare</option>
                <option value="duration">Shortest duration</option>
                <option value="departure">Earliest departure</option>
              </select>
            </Field>
          </div>
        </details>
        <button className="button">Search flights →</button>
      </form>
      {ready && <Status state={result} />}{" "}
      {legPage && options("Outbound flights", legPage, "out")}
      {backPage && options("Return flights", backPage, "back")}
      {legPage && (
        <Pager
          page={page}
          pages={Math.max(legPage.pages, backPage?.pages || 0)}
          onPage={(n) =>
            router.push("/flights?" + qs({ ...parameters, page: n }))
          }
        />
      )}
      {chosen.out && (
        <aside className="panel">
          <h2>Your selection</h2>
          <p>
            {chosen.out.flightNumber} · {chosen.out.cabin}
            {chosen.back &&
              " / " + chosen.back.flightNumber + " · " + chosen.back.cabin}
          </p>
          {next ? (
            <Link className="button" href={next}>
              Continue to travelers →
            </Link>
          ) : (
            <p>Select a return fare.</p>
          )}
        </aside>
      )}
    </main>
  );
}

export function FlightDetail({ id }: { id: string }) {
  const q = useSearchParams(),
    router = useRouter(),
    a = useAction();
  const flight = useLoad<Flight>("/flights/" + id),
    backId = q.get("back"),
    back = useLoad<Flight>(backId ? "/flights/" + backId : null),
    me = useLoad<{ role: string }>("/auth/me");
  const [cabin, setCabin] = useState(q.get("cabin") || ""),
    [quote, setQuote] = useState<{
      amount: number;
      currency: string;
      segments: Segment[];
      passengers: Passenger[];
    } | null>(null);
  const [payload, setPayload] = useState<{
    segments: { flightId: string; cabin: string }[];
    passengers: Passenger[];
  } | null>(null);
  const [bagCounts, setBags] = useState<Record<number, number>>({});
  if (!flight.data || (backId && !back.data))
    return (
      <main className="booking-view">
        <Status state={!flight.data ? flight : back} />
      </main>
    );
  const f = flight.data,
    category =
      cabin || f.cabins.find((c) => c.seatsRemaining > 0)?.category || "",
    returnCategory = q.get("backCabin") || category;
  const legEntries = [
    { flight: f, category },
    ...(back.data ? [{ flight: back.data, category: returnCategory }] : []),
  ];
  const types = ["adult", "child", "infant"].flatMap((t, i) =>
    Array.from(
      {
        length: Math.max(
          i ? 0 : 1,
          Math.min(
            1000,
            Number(q.get(["adults", "children", "infants"][i])) || 0,
          ),
        ),
      },
      () => t,
    ),
  );
  const maxBags = Math.min(...legEntries.map((l) => l.flight.maxExtraBags));
  const weightLimit = Math.min(
    ...legEntries.map(
      (l) =>
        l.flight.cabins.find((c) => c.category === l.category)?.bagWeightKg ??
        0,
    ),
  );
  return (
    <main className="booking-view stack">
      <Link
        href={
          "/flights?" +
          qs(Object.fromEntries(searchKeys.map((k) => [k, q.get(k) || ""])))
        }
      >
        ← Flight search
      </Link>
      <header>
        <p className="eyebrow">Flight details</p>
        <h1>
          {f.departureAirport} → {f.arrivalAirport}
        </h1>
      </header>
      {legEntries.map(({ flight: l, category: cat }, i) => (
        <section key={l._id} className="panel stack">
          <div>
            <p>
              {i ? "Return" : "Outbound"} · {l.airline.name}
            </p>
            <h2>
              {l.flightNumber} · {l.departureAirport} → {l.arrivalAirport}
            </h2>
            <p>
              {atAirport(l.departureLocal)} → {atAirport(l.arrivalLocal)} ·
              airport-local times ·{" "}
              {Math.round(
                (Date.parse(l.arrivalLocal) - Date.parse(l.departureLocal)) /
                  60000,
              )}{" "}
              minutes
            </p>
          </div>
          <div className="grid">
            {l.cabins.map((c) => (
              <div key={c.category} className="fare-cabin">
                <strong>
                  {c.category} · {money(c.price, l.currency)}
                </strong>
                <p>
                  {c.seatsRemaining} seats left · {c.freeBags} checked bags ·{" "}
                  {c.bagWeightKg} kg each
                </p>
              </div>
            ))}
          </div>
          {i === 0 ? (
            <Field label="Your cabin">
              <select
                value={category}
                onChange={(e) => {
                  setCabin(e.target.value);
                  setQuote(null);
                }}
              >
                {l.cabins.map((c) => (
                  <option key={c.category} disabled={c.seatsRemaining === 0}>
                    {c.category}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p>Selected cabin · {cat}</p>
          )}
          <p>
            Extra bags · {money(l.extraBagPrice, l.currency)} each · up to{" "}
            {l.maxExtraBags} per passenger
          </p>
          <Tiers tiers={l.cancellationTiers} />
        </section>
      ))}
      {q.get("details") === "1" && q.get("returnDate") && !backId ? (
        <Link
          className="button"
          href={
            "/flights?" +
            qs(Object.fromEntries(searchKeys.map((k) => [k, q.get(k) || ""])))
          }
        >
          Return to search and select both flights
        </Link>
      ) : !me.data ? (
        <div className="panel">
          <SignIn
            label="Sign in to book this flight"
            returnTo={
              "/flight/" +
              id +
              "?" +
              qs({ ...Object.fromEntries(q), cabin: category })
            }
          />
        </div>
      ) : me.data.role !== "User" ? (
        <p className="notice">Booking is available to traveler accounts.</p>
      ) : (
        <form
          className="stack"
          onChange={() => setQuote(null)}
          onSubmit={submit((form) =>
            a.run(async () => {
              const d = formData(form);
              const segments = legEntries.map((l) => ({
                flightId: l.flight._id,
                cabin: l.category,
              }));
              const passengers = types.map((type, i) => ({
                type,
                fullName: d["name" + i],
                dateOfBirth: d["dob" + i],
                identityNumber: d["id" + i],
                extraBags: bagCounts[i] || 0,
                bagWeightsKg: Array.from(
                  { length: bagCounts[i] || 0 },
                  (_, j) => Number(d["kg" + i + "-" + j]),
                ),
              }));
              for (const [i, p] of passengers.entries()) {
                for (const leg of legEntries) {
                  const travelDay = leg.flight.departureLocal.slice(0, 10);
                  const birth = p.dateOfBirth;
                  const age =
                    Number(travelDay.slice(0, 4)) -
                    Number(birth.slice(0, 4)) -
                    (travelDay.slice(5) < birth.slice(5) ? 1 : 0);
                  const expected =
                    age < 2 ? "infant" : age < 12 ? "child" : "adult";
                  if (age < 0 || expected !== p.type) {
                    invalidField(
                      form,
                      "dob" + i,
                      "Date of birth must match a " +
                        p.type +
                        " on every departure date.",
                    );
                    return;
                  }
                }
              }
              const body = { segments, passengers };
              const response = await api<NonNullable<typeof quote>>(
                "/flight-bookings",
                { method: "POST", body },
              );
              setPayload(body);
              setQuote(response);
            }),
          )}
        >
          <h2>Travelers &amp; baggage</h2>
          {types.map((t, i) => (
            <fieldset key={i} className="panel stack">
              <legend>
                Traveler {i + 1} · {t}
              </legend>
              <div className="grid">
                <Field label="Full name on document">
                  <input
                    name={"name" + i}
                    data-api-field={"passengers." + i + ".fullName"}
                    autoComplete="off"
                    maxLength={150}
                    required
                  />
                </Field>
                <Field label="Date of birth">
                  <input
                    name={"dob" + i}
                    data-api-field={"passengers." + i + ".dateOfBirth"}
                    type="date"
                    required
                  />
                </Field>
                <Field label="Passport or ID number">
                  <input
                    name={"id" + i}
                    data-api-field={"passengers." + i + ".identityNumber"}
                    maxLength={50}
                    autoComplete="off"
                    required
                  />
                </Field>
                <Field label="Additional checked bags">
                  <input
                    type="number"
                    min={0}
                    max={maxBags}
                    name={"bags" + i}
                    data-api-field={"passengers." + i + ".extraBags"}
                    value={bagCounts[i] || 0}
                    onChange={(e) =>
                      setBags({
                        ...bagCounts,
                        [i]: Math.max(
                          0,
                          Math.min(maxBags, Number(e.target.value) || 0),
                        ),
                      })
                    }
                  />
                </Field>
                {Array.from({ length: bagCounts[i] || 0 }, (_, j) => (
                  <Field key={j} label={"Bag " + (j + 1) + " weight (kg)"}>
                    <input
                      required
                      name={"kg" + i + "-" + j}
                      data-api-field={"passengers." + i + ".bagWeightsKg"}
                      type="number"
                      min=".01"
                      max={weightLimit}
                      step=".01"
                    />
                  </Field>
                ))}
              </div>
            </fieldset>
          ))}
          <ErrorLine text={a.error} />
          <button
            className="button"
            disabled={
              a.busy ||
              !category ||
              legEntries.some(
                (l) =>
                  !l.flight.cabins.some(
                    (c) =>
                      c.category === l.category &&
                      c.seatsRemaining >=
                        types.filter((t) => t !== "infant").length,
                  ),
              )
            }
          >
            Review fare
          </button>
        </form>
      )}
      {quote && payload && (
        <section className="panel stack" aria-live="polite">
          <h2>Booking summary</h2>
          {quote.segments.map((s) => (
            <p key={s.flightId}>
              {s.airlineName} {s.flightNumber} · {s.cabin} ·{" "}
              {money(s.total, quote.currency)}
            </p>
          ))}
          <PagedRows label="Passenger summary pages">
            {quote.passengers.map((p, i) => (
              <p key={i}>
                {p.fullName} · {p.type} · {p.extraBags} extra bags
              </p>
            ))}
          </PagedRows>
          <strong>Total {money(quote.amount, quote.currency)}</strong>
          <button
            className="button"
            disabled={a.busy}
            onClick={() =>
              a.run(async () => {
                const b = await api<Booking>("/flight-bookings/hold", {
                  method: "POST",
                  body: payload,
                });
                router.push(ticketLink(b._id, "flight"));
              })
            }
          >
            Hold seats for 10 minutes →
          </button>
        </section>
      )}
    </main>
  );
}
