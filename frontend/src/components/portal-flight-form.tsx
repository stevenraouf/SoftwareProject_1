"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cabins, useAirports, type Airport } from "@/features/booking/shared";
import { cityGuides, findPlace, places } from "@/lib/destinations";
import { useFormErrors } from "@/lib/form-errors";
import {
  cityName,
  flightQuery,
  sampleDate,
  type FlightDraft,
} from "./portal-draft";
import "./portal.css";

type AirportField = "departureAirport" | "arrivalAirport";
type Choice = { code: string; name: string; city: string; country: string };

export function AirportPicker({
  field,
  current,
  directory,
  onPick,
  onClose,
  today = new Date().toISOString().slice(0, 10),
}: {
  field: AirportField;
  current: string;
  directory: Airport[];
  onPick: (code: string) => void;
  onClose: () => void;
  today?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const monthDay = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const sampleLabel = (code: string) =>
    monthDay.format(new Date(sampleDate(code, today) + "T12:00:00Z"));
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const choices: Choice[] = places.map(([code, , city]) => ({
    code,
    city,
    country: cityGuides[code].country,
    name: cityGuides[code].airport,
  }));
  for (const airport of directory) {
    if (!findPlace(airport.iata_code))
      choices.push({
        code: airport.iata_code,
        name: airport.name,
        city: airport.name,
        country: airport.time_zone,
      });
  }
  const search = query.trim().toLowerCase();
  const visible = choices.filter(({ code, name, city, country }) =>
    [code, name, city, country].some((text) =>
      text.toLowerCase().includes(search),
    ),
  );
  function pick(code: string) {
    onPick(code);
    dialog.current?.close();
  }
  return (
    <dialog
      ref={dialog}
      className="portal-picker"
      aria-labelledby="airport-picker-title"
      onClose={onClose}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          dialog.current?.close();
        }
      }}
    >
      <div className="picker-header">
        <h2 id="airport-picker-title">
          {field === "arrivalAirport"
            ? "Choose destination"
            : "Choose departure"}
        </h2>
        <button
          type="button"
          className="text-action"
          onClick={() => dialog.current?.close()}
        >
          Cancel
        </button>
      </div>
      <input
        type="search"
        autoFocus
        aria-label="Search airports"
        placeholder="Search city, airport or code"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !search) return;
          const match =
            visible.find(({ code }) => code.toLowerCase() === search) ||
            (visible.length === 1 ? visible[0] : undefined);
          if (match) {
            event.preventDefault();
            pick(match.code);
          }
        }}
      />
      <div className="airport-choices">
        {visible.map(({ code, name, city, country }) => (
          <button
            type="button"
            key={code}
            className="airport-choice"
            aria-pressed={current === code}
            onClick={() => pick(code)}
          >
            <span>
              <strong>
                {city}
                {country && " · " + country}
              </strong>
              <small>{name}</small>
            </span>
            <span>
              <b>{code}</b>
              {current === code && <small>Selected</small>}
            </span>
          </button>
        ))}
        {visible.length === 0 &&
          (!directory.length && /^[a-z]{3}$/.test(search) ? (
            <button
              type="button"
              className="secondary"
              onClick={() => pick(search.toUpperCase())}
            >
              Use airport code {search.toUpperCase()}
            </button>
          ) : (
            <p role="status">No matching airports.</p>
          ))}
      </div>
      <p className="picker-note">
        Sample routes leave Cairo on {sampleLabel("CDG")}, or Dubai on{" "}
        {sampleLabel("CAI")} for Cairo.
      </p>
    </dialog>
  );
}

function DateField({
  label,
  name,
  value,
  minimum,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  minimum?: string;
  onChange: (value: string) => void;
}) {
  const parsed = new Date(value + "T12:00:00Z");
  const formatted = Number.isNaN(parsed.getTime())
    ? "Choose date"
    : new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(parsed);
  return (
    <label className="portal-date">
      <span>{label}</span>
      <strong aria-hidden="true">{formatted}</strong>
      <input
        type="date"
        name={name}
        aria-label={label + " date"}
        value={value}
        required
        min={minimum}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker();
          } catch {
            /* The native input remains keyboard-editable. */
          }
        }}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function PortalFlightForm({
  draft,
  title,
  dedicated,
  onChange,
  onAirport,
  today,
  interactive,
}: {
  draft: FlightDraft;
  today: string;
  interactive: boolean;
  title: string;
  dedicated?: boolean;
  onChange: (fields: Partial<FlightDraft>) => void;
  onAirport: (field: AirportField, code: string) => void;
}) {
  const router = useRouter();
  const directory = useAirports();
  const { formEvents, errors, setErrors } = useFormErrors();
  const [picker, setPicker] = useState<AirportField | null>(null);
  const travelerDetails = useRef<HTMLDetailsElement>(null);
  const party =
    Number(draft.adults) + Number(draft.children) + Number(draft.infants);
  const summary =
    Number(draft.children) || Number(draft.infants)
      ? party + " travelers"
      : draft.adults + (draft.adults === "1" ? " adult" : " adults");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.departureAirport === draft.arrivalAirport) {
      setErrors({ arrivalAirport: "Choose a different arrival airport." });
      return;
    }
    if (Number(draft.infants) > Number(draft.adults)) {
      if (travelerDetails.current) travelerDetails.current.open = true;
      setErrors({ infants: "Each lap infant must travel with an adult." });
      return;
    }
    router.push("/flights?" + flightQuery(draft));
  }
  function airportButton(field: AirportField, label: string) {
    const code = draft[field];
    const city =
      findPlace(code)?.[2] ||
      directory.find((a) => a.iata_code === code)?.name ||
      code;
    return (
      <button
        type="button"
        className="airport-field"
        disabled={!interactive}
        value={code}
        aria-label={
          field === "arrivalAirport" ? "Arrival airport" : "Departure airport"
        }
        aria-haspopup="dialog"
        onClick={() => setPicker(field)}
      >
        <small>{label}</small>
        <strong>{city === code ? code : city + " (" + code + ")"}</strong>
      </button>
    );
  }
  return (
    <>
      <form
        id="find-flight"
        action="/flights"
        method="get"
        tabIndex={-1}
        className={
          "flightbar panel portal-flight" + (dedicated ? " draft-form" : "")
        }
        onSubmit={submit}
        {...formEvents}
      >
        <input
          type="hidden"
          name="departureAirport"
          value={draft.departureAirport}
        />
        <input
          type="hidden"
          name="arrivalAirport"
          value={draft.arrivalAirport}
        />
        <div className="section-line">
          {dedicated ? (
            <>
              <div className="trip-modes" aria-label="Trip type">
                <button
                  type="button"
                  aria-pressed={!draft.round}
                  disabled={!interactive}
                  onClick={() => onChange({ round: false })}
                >
                  One way
                </button>
                <button
                  type="button"
                  aria-pressed={draft.round}
                  disabled={!interactive}
                  onClick={() => onChange({ round: true })}
                >
                  Round trip
                </button>
              </div>
              <small>USD</small>
            </>
          ) : (
            <>
              <h2>{title}</h2>
              <select
                aria-label="Trip type"
                disabled={!interactive}
                value={draft.round ? "round" : "one"}
                onChange={(e) =>
                  onChange({ round: e.target.value === "round" })
                }
              >
                <option value="one">One way</option>
                <option value="round">Round trip</option>
              </select>
            </>
          )}
        </div>
        <div className={"quickfields" + (draft.round ? " round-flight" : "")}>
          {airportButton("departureAirport", "From")}
          {dedicated && (
            <button
              type="button"
              className="swap-airports secondary"
              disabled={!interactive}
              aria-label="Swap airports"
              onClick={() =>
                onChange({
                  departureAirport: draft.arrivalAirport,
                  arrivalAirport: draft.departureAirport,
                })
              }
            >
              ⇄
            </button>
          )}
          {airportButton("arrivalAirport", "To")}
          <DateField
            label="Departure"
            name="departureDate"
            value={draft.departureDate}
            onChange={(departureDate) => onChange({ departureDate })}
          />
          {draft.round && (
            <DateField
              label="Return"
              name="returnDate"
              value={draft.returnDate}
              minimum={draft.departureDate}
              onChange={(returnDate) => onChange({ returnDate })}
            />
          )}
          <details className="quick-passengers" ref={travelerDetails}>
            <summary>
              <small>Travelers &amp; cabin</small>
              {summary} · {draft.cabin}
            </summary>
            <div className="popover stack">
              {(["adults", "children", "infants"] as const).map((key, i) => (
                <label key={key}>
                  {["Adults", "Children · 2–11", "Lap infants · under 2"][i]}
                  <input
                    name={key}
                    type="number"
                    required
                    min={i === 0 ? 1 : 0}
                    max={1000}
                    value={draft[key]}
                    onChange={(e) => onChange({ [key]: e.target.value })}
                  />
                </label>
              ))}
              <label>
                Cabin
                <select
                  value={draft.cabin}
                  name="cabin"
                  onChange={(e) => onChange({ cabin: e.target.value })}
                >
                  {cabins.map((cabin) => (
                    <option key={cabin}>{cabin}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (travelerDetails.current) {
                    travelerDetails.current.open = false;
                    travelerDetails.current.querySelector("summary")?.focus();
                  }
                }}
              >
                Done
              </button>
            </div>
          </details>
          <button className="primary portal-search">
            Search flights <span aria-hidden="true">→</span>
          </button>
        </div>
        {Object.entries(errors).map(([key, text]) => (
          <small key={key} className="invalid" role="alert">
            {text}
          </small>
        ))}
        <small className="portal-form-note">
          {dedicated
            ? "Times are local to each airport."
            : "Sample date and traveler count"}
        </small>
      </form>
      {picker && (
        <AirportPicker
          today={today}
          field={picker}
          current={draft[picker]}
          directory={directory}
          onClose={() => setPicker(null)}
          onPick={(code) => {
            setErrors({});
            onAirport(picker, code);
          }}
        />
      )}
    </>
  );
}

export function AirportPair({ draft }: { draft: FlightDraft }) {
  const directory = useAirports();
  return (
    <section className="panel airport-pair">
      <h2>Your airports</h2>
      <div>
        {(
          [
            ["Departure", draft.departureAirport],
            ["Arrival", draft.arrivalAirport],
          ] as const
        ).map(([label, code]) => {
          const place = findPlace(code),
            airport = directory.find((a) => a.iata_code === code);
          return (
            <section key={label}>
              <p className="kicker">{label}</p>
              <strong>
                {place?.[5] || airport?.name || cityName(code)} ({code})
              </strong>
              <small>
                {place ? cityGuides[place[0]].zone : airport?.time_zone}
              </small>
            </section>
          );
        })}
      </div>
    </section>
  );
}
