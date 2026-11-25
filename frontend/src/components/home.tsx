"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useFormErrors } from "@/lib/form-errors";

import { places } from "@/lib/destinations";

type Airport = { iata_code: string; name: string; city?: string };
function FlightBar({ arrival }: { arrival: string }) {
  const router = useRouter();
  const { errors, setErrors, formEvents } = useFormErrors();
  const errorProps = (field: string) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? "flight-error-" + field : undefined,
  });
  const fieldError = (field: string) =>
    errors[field] && (
      <small role="alert" className="invalid" id={"flight-error-" + field}>
        {errors[field]}
      </small>
    );
  const [airports, setAirports] = useState<Airport[]>([]),
    [round, setRound] = useState(false),
    [date, setDate] = useState("");
  const [hint, setHint] = useState(""),
    [adults, setAdults] = useState(1),
    [cabin, setCabin] = useState("Economy");
  useEffect(() => {
    let active = true;
    (async () => {
      const first = await api("/airports");
      const more = await Promise.all(
        Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) =>
          api("/airports?page=" + (i + 2)),
        ),
      );
      if (active) setAirports([first, ...more].flatMap((page) => page.items));
    })().catch(() => {
      if (active)
        setHint(
          "Airport directory is offline. You can still enter an IATA airport code.",
        );
    });
    return () => {
      active = false;
    };
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const origin = String(values.get("departureAirport")).toUpperCase().trim(),
      to = String(values.get("arrivalAirport")).toUpperCase().trim();
    for (const [field, code] of [
      ["departureAirport", origin],
      ["arrivalAirport", to],
    ]) {
      if (airports.length && !airports.some((a) => a.iata_code === code)) {
        setErrors({ [field]: "Choose an airport from the airport directory." });
        return;
      }
    }
    if (origin === to) {
      setErrors({ arrivalAirport: "Choose a different arrival airport." });
      return;
    }
    const query = new URLSearchParams({
      departureAirport: origin,
      arrivalAirport: to,
      departureDate: date,
      adults: String(adults),
      cabin,
    });
    if (round) query.set("returnDate", String(values.get("returnDate")));
    router.push("/flights?" + query);
  }
  return (
    <form
      id="find-flight"
      className="flightbar panel"
      onSubmit={submit}
      {...formEvents}
    >
      <div className="section-line">
        <h2>Find a flight</h2>
        <select
          aria-label="Trip type"
          value={round ? "round" : "one"}
          onChange={(e) => setRound(e.target.value === "round")}
        >
          <option value="one">One way</option>
          <option value="round">Round trip</option>
        </select>
      </div>
      <div className="quickfields">
        <label>
          From
          <input
            aria-label="Departure airport"
            name="departureAirport"
            {...errorProps("departureAirport")}
            list="airport-options"
            required
            pattern="[A-Za-z]{3}"
            maxLength={3}
            defaultValue={arrival === "CAI" ? "DXB" : "CAI"}
          />
          {fieldError("departureAirport")}
        </label>
        <label>
          To
          <input
            aria-label="Arrival airport"
            name="arrivalAirport"
            {...errorProps("arrivalAirport")}
            list="airport-options"
            required
            pattern="[A-Za-z]{3}"
            maxLength={3}
            defaultValue={arrival}
          />
          {fieldError("arrivalAirport")}
        </label>
        <datalist id="airport-options">
          {airports.map((a) => (
            <option key={a.iata_code} value={a.iata_code}>
              {a.name}
            </option>
          ))}
        </datalist>
        <label>
          Departure
          <input
            type="date"
            name="departureDate"
            {...errorProps("departureDate")}
            aria-label="Departure date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {fieldError("departureDate")}
        </label>
        {round && (
          <label>
            Return
            <input
              type="date"
              name="returnDate"
              min={date}
              required
              {...errorProps("returnDate")}
            />
            {fieldError("returnDate")}
          </label>
        )}
        <details className="quick-passengers">
          <summary>
            <small>Travelers &amp; cabin</small>
            {adults} adult{adults === 1 ? "" : "s"} · {cabin}
          </summary>
          <div className="popover stack">
            <label>
              Adults
              <input
                type="number"
                name="adults"
                {...errorProps("adults")}
                min="1"
                max="1000"
                required
                value={adults}
                onChange={(e) => setAdults(+e.target.value)}
              />
              {fieldError("adults")}
            </label>
            <label>
              Cabin
              <select value={cabin} onChange={(e) => setCabin(e.target.value)}>
                {["Economy", "Premium Economy", "Business", "First"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            <Link href="/flights">More traveler options</Link>
          </div>
        </details>
        <button className="primary">
          Search flights <span aria-hidden>→</span>
        </button>
      </div>
      {hint && (
        <p role="status" className="muted">
          {hint}
        </p>
      )}
    </form>
  );
}

export function WindowHome({ destination }: { destination?: string }) {
  const [selected, setSelected] = useState(0);
  const rail = useRef<HTMLDivElement>(null);
  const index = destination
    ? places.findIndex((p) => p[0] === destination.toUpperCase())
    : selected;
  if (index < 0)
    return (
      <main className="wrap">
        <h1>Destination unavailable</h1>
        <Link href="/">Choose a window</Link>
      </main>
    );
  const [code, country, city, greeting, lang, airport] = places[index];
  function choose(i: number) {
    const next = (i + places.length) % places.length;
    setSelected(next);
    const target = rail.current?.children[next] as HTMLElement | undefined;
    if (target && rail.current)
      rail.current.scrollLeft +=
        target.getBoundingClientRect().left -
        rail.current.getBoundingClientRect().left -
        16;
  }
  if (destination)
    return (
      <main className="arrival">
        <div className="wrap">
          <Link href="/" className="back">
            ← Back to explore
          </Link>
          <section className="arrival-view">
            <img
              src={"/art/" + code + "-landscape.jpg"}
              alt={city + " destination landscape"}
            />
            <div>
              <p className="kicker">
                {country} · {city}
              </p>
              <h1
                className="glass arrival-word"
                lang={lang}
                dir={lang === "ar" ? "rtl" : "ltr"}
              >
                {greeting}
              </h1>
              <p>Welcome to {city}.</p>
              <a className="button secondary" href="#find-flight">
                Choose {code} →
              </a>
            </div>
          </section>
          <FlightBar key={code} arrival={code} />
          <section className="panel arrival-airport">
            <h2>Your airport</h2>
            <p>
              {airport} · {code}
            </p>
            <Link href={"/stays?destination=" + encodeURIComponent(city)}>
              Find a stay in {city} →
            </Link>
          </section>
        </div>
      </main>
    );
  return (
    <main className="home">
      <section className="hero">
        <div className="wrap hero-content">
          <div className="hero-copy">
            <p className="kicker">The window seat</p>
            <h1
              className="glass typed"
              aria-label="Where will your window take you?"
            >
              <span className="heading-line">Where will your</span>{" "}
              <span className="heading-line">window take you?</span>
            </h1>
            <p className="intro">
              <span className="desktop-copy">
                Choose a view through the cabin window, then find the flights
                that take you there.
              </span>
              <span className="phone-copy">
                Choose a view.
                <br />
                Find your next flight.
              </span>
            </p>
            <div className="actions hero-actions">
              <Link className="button secondary" href={"/explore/" + code}>
                Explore {country} <span aria-hidden>→</span>
              </Link>
              <a href="#find-flight" className="text-action">
                Find a flight ↓
              </a>
            </div>
          </div>
          <div className="window-assembly">
            <div className="window-glass">
              <img
                key={code}
                className="scene"
                src={"/art/" + code + "-window.jpg"}
                alt={city + " seen through the cabin window"}
              />
              <div className="window-name">
                <small>{country}</small>
                <strong>{city}</strong>
              </div>
            </div>
            <img className="surround" src="/art/window-shell.png" alt="" />
          </div>
        </div>
      </section>
      <div className="wrap">
        <section className="windows" aria-label="Destination windows">
          <div className="section-line">
            <h2>Choose a window</h2>
            <div className="actions">
              <button
                className="round secondary"
                aria-label="Previous destination"
                onClick={() => choose(index - 1)}
              >
                ←
              </button>
              <button
                className="round secondary"
                aria-label="Next destination"
                onClick={() => choose(index + 1)}
              >
                →
              </button>
            </div>
          </div>
          <div ref={rail} className="destination-rail">
            {places.map(([key, name], i) => (
              <button
                key={key}
                aria-label={name}
                aria-pressed={selected === i}
                onClick={() => choose(i)}
              >
                <img alt="" src={"/art/" + key + "-landscape.jpg"} />
                <span>{name}</span>
                {selected === i && <b aria-hidden>✓</b>}
              </button>
            ))}
          </div>
        </section>
        <FlightBar arrival="CDG" />
      </div>
    </main>
  );
}
