"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  cityGuides,
  findPlace,
  places,
  type AirportCode,
  type Place,
} from "@/lib/destinations";
import { AirportPair, PortalFlightForm } from "./portal-flight-form";
import {
  cityName,
  initialDraft,
  portalHref,
  withDestination,
  type FlightDraft,
} from "./portal-draft";

function reducedMotion() {
  const preference = document.documentElement.dataset.motion;
  return (
    preference === "reduced" ||
    (!preference &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

function CabinWindow({
  place,
  previous,
  finish,
  label = true,
}: {
  place: Place;
  previous?: AirportCode;
  finish?: () => void;
  label?: boolean;
}) {
  const [code] = place;
  const guide = cityGuides[code];
  return (
    <div className="window-assembly">
      <div className="window-glass">
        {previous && (
          <img
            className="scene scene-outgoing"
            key={"from-" + previous + "-" + code}
            alt=""
            src={"/art/" + previous + "-window.jpg"}
          />
        )}
        <img
          key={(previous || "") + code}
          className={"scene" + (previous ? " scene-incoming" : "")}
          src={"/art/" + code + "-window.jpg"}
          alt={guide.landscape + " seen through the cabin window"}
        />
        {label && (
          <div className="window-name">
            <small>{guide.country}</small>
            <strong>{guide.landscape}</strong>
          </div>
        )}
      </div>
      <img className="surround" src="/art/window-shell.png" alt="" />
      {previous && (
        <button className="skip-shuffle" type="button" onClick={finish}>
          Skip animation
        </button>
      )}
    </div>
  );
}

export function WindowHome({
  destination,
  flightDraft = false,
  initialQuery = "",
  today,
}: {
  destination?: string;
  flightDraft?: boolean;
  initialQuery?: string;
  today: string;
}) {
  const initial = new URLSearchParams(initialQuery);
  const router = useRouter();
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  const routedPlace = destination ? findPlace(destination) : undefined;
  const [selected, setSelected] = useState<AirportCode>(
    () =>
      routedPlace?.[0] || findPlace(initial.get("window") || "")?.[0] || "CDG",
  );
  const [draft, setDraft] = useState<FlightDraft>(() =>
    initialDraft(selected, initial, today),
  );
  const [previous, setPrevious] = useState<AirportCode>();
  const rail = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef(0);
  const place = routedPlace || findPlace(selected)!;
  const [code, country, city, greeting, lang, airport] = place;
  const guide = cityGuides[code];
  const index = places.findIndex(([iata]) => iata === code);
  const arrivalPath = "/explore/" + code;
  const draftPath = arrivalPath + "/flights";
  useEffect(() => {
    if (!previous) return;
    const finish = () => setPrevious(undefined);
    const timer = window.setTimeout(finish, 465);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", escape);
    };
  }, [previous, selected]);
  useEffect(() => () => window.cancelAnimationFrame(scrollFrame.current), []);
  useEffect(() => {
    if (!rail.current) return;
    const active = places.findIndex(([iata]) => iata === selected);
    const item = rail.current.children[Math.max(0, active - 1)];
    if (item)
      rail.current.scrollLeft +=
        item.getBoundingClientRect().left -
        rail.current.getBoundingClientRect().left;
  }, [selected]);

  function store(next: FlightDraft, view: AirportCode = selected) {
    setDraft(next);
    const url =
      portalHref(
        window.location.pathname,
        next,
        destination ? undefined : view,
      ) + window.location.hash;
    window.history.replaceState(window.history.state, "", url);
  }
  function choose(next: AirportCode) {
    if (next !== selected) {
      setPrevious(reducedMotion() ? undefined : selected);
      setSelected(next);
    }
    store(withDestination(draft, next, today), next);
  }
  function setAirport(
    field: "departureAirport" | "arrivalAirport",
    value: string,
  ) {
    if (field === "arrivalAirport") {
      const linked = findPlace(value);
      const next = withDestination(draft, value, today);
      if (linked && !destination) choose(linked[0]);
      else if (linked && linked[0] !== code) {
        router.push(
          flightDraft
            ? portalHref("/explore/" + linked[0] + "/flights", next)
            : portalHref("/", next, linked[0]),
          { scroll: false },
        );
      } else store(next);
    } else {
      updateDraft({
        departureAirport: value,
        arrivalAirport:
          value === draft.arrivalAirport
            ? draft.departureAirport
            : draft.arrivalAirport,
      });
    }
  }
  function scrollToForm(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const form = document.getElementById("find-flight");
    if (!form) return;
    event.preventDefault();
    const initialY = window.scrollY;
    const top = Math.min(
      initialY + form.getBoundingClientRect().top - 16,
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    );
    if (window.location.hash !== "#find-flight")
      window.history.pushState(window.history.state, "", "#find-flight");
    form.focus({ preventScroll: true });
    window.cancelAnimationFrame(scrollFrame.current);
    if (reducedMotion()) {
      window.scrollTo(0, top);
      return;
    }
    const start = performance.now();
    function nextFrame(now: number) {
      const progress = Math.min(1, (now - start) / 240);
      window.scrollTo(
        0,
        initialY + (top - initialY) * (1 - (1 - progress) ** 3),
      );
      if (progress < 1)
        scrollFrame.current = window.requestAnimationFrame(nextFrame);
    }
    scrollFrame.current = window.requestAnimationFrame(nextFrame);
  }
  if (destination && !routedPlace)
    return (
      <main className="wrap content">
        <h1>Destination unavailable</h1>
        <Link href="/">Choose a window</Link>
      </main>
    );
  function updateDraft(fields: Partial<FlightDraft>) {
    const next = { ...draft, ...fields };
    if (fields.departureDate !== undefined) next.sampleDeparture = false;
    if (fields.departureAirport !== undefined) next.defaultOrigin = false;
    const destinationPlace =
      fields.arrivalAirport && findPlace(fields.arrivalAirport);
    if (flightDraft && destinationPlace && destinationPlace[0] !== code) {
      router.push(
        portalHref("/explore/" + destinationPlace[0] + "/flights", next),
        { scroll: false },
      );
    } else store(next);
  }
  const form = (
    <PortalFlightForm
      interactive={interactive}
      today={today}
      draft={draft}
      onAirport={setAirport}
      onChange={updateDraft}
      title={destination ? "Find flights to " + city : "Find a flight"}
      dedicated={flightDraft}
    />
  );
  if (flightDraft)
    return (
      <main className="destination-portal flight-draft">
        <section className="hero">
          <div className="wrap hero-content">
            <div className="hero-copy">
              <p className="kicker">{guide.country}</p>
              <h1 className="glass">Flights to {city}</h1>
              <p className="intro">
                Departing from {cityName(draft.departureAirport)}.
              </p>
              <Link
                className="button secondary"
                href={portalHref(arrivalPath, draft)}
              >
                Explore {city} →
              </Link>
            </div>
            <CabinWindow place={place} label={false} />
          </div>
        </section>
        <div className="wrap">
          {form}
          <AirportPair draft={draft} />
        </div>
      </main>
    );
  if (destination)
    return (
      <main className="destination-portal city-arrival">
        <section className="destination-hero">
          <picture>
            <source
              media="(max-width: 650px)"
              srcSet={"/art/" + code + "-window.jpg"}
            />
            <img
              className="destination-landscape"
              src={"/art/" + code + "-landscape.jpg"}
              alt={guide.landscape + " destination landscape"}
            />
          </picture>
          <div className="wrap">
            <Link
              href={portalHref("/", draft, code)}
              className="destination-back"
            >
              ← Back to windows
            </Link>
            <div className="destination-intro">
              <p className="kicker">
                {guide.country} · {city}
              </p>
              <h1
                className="glass arrival-word"
                lang={lang}
                dir={lang === "ar" ? "rtl" : "ltr"}
              >
                {greeting}
              </h1>
              <p className="city-story">{guide.story}</p>
              <Link
                className="button secondary"
                href={portalHref(
                  draftPath,
                  withDestination(draft, code, today),
                )}
              >
                Fly to {code} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
        <div className="wrap">
          <section className="panel destination-airport">
            <div>
              <p className="kicker">Destination airport</p>
              <h2>
                {airport} ({code})
              </h2>
              <span>
                {city} · {guide.country}
              </span>
            </div>
            <Link
              className="button secondary"
              href={portalHref(draftPath, withDestination(draft, code, today))}
            >
              Choose {code} <span aria-hidden="true">→</span>
            </Link>
          </section>
          {form}
          <Link
            className="city-stays"
            href={"/stays?destination=" + encodeURIComponent(city)}
          >
            Find a stay in {city} →
          </Link>
        </div>
      </main>
    );
  return (
    <main className="home destination-portal">
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
              <Link
                className="button secondary"
                href={portalHref(arrivalPath, draft)}
              >
                Explore {country} <span aria-hidden="true">→</span>
              </Link>
              <a
                href="#find-flight"
                className="text-action"
                onClick={scrollToForm}
              >
                <span className="desktop-copy">Find flights</span>
                <span className="phone-copy">Find a flight ↓</span>
              </a>
            </div>
          </div>
          <CabinWindow
            place={place}
            previous={previous}
            finish={() => setPrevious(undefined)}
          />
        </div>
      </section>
      <div className="wrap">
        <section className="windows" aria-label="Destination windows">
          <div className="section-line">
            <h2>Choose a window</h2>
            <div className="actions">
              {[-1, 1].map((step) => (
                <button
                  key={step}
                  className="round secondary"
                  disabled={!interactive}
                  aria-label={
                    step === 1 ? "Next destination" : "Previous destination"
                  }
                  onClick={() =>
                    choose(
                      places[(index + places.length + step) % places.length][0],
                    )
                  }
                >
                  {step === 1 ? "→" : "←"}
                </button>
              ))}
            </div>
          </div>
          <div ref={rail} className="destination-rail">
            {places.map(([iata, name]) => (
              <button
                key={iata}
                aria-label={name}
                disabled={!interactive}
                aria-pressed={code === iata}
                onClick={() => choose(iata)}
              >
                <img alt="" src={"/art/" + iata + "-window.jpg"} />
                <span>{name}</span>
                {code === iata && <b aria-hidden="true">✓</b>}
              </button>
            ))}
          </div>
        </section>
        {form}
      </div>
    </main>
  );
}
