"use client";

import { useEffect, useRef, useState } from "react";
import { Field, formData, invalidField, submit } from "./shared";
import "./stay-search.css";

export type StayParty = { rooms: number; adults: number; children: number };
export type StayDates = { checkIn: string; checkOut: string };
export type StayPicker = "dates" | "party";

function dateValue(iso: string) {
  const date = new Date(iso + "T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? date
    : null;
}

export function readableDate(iso: string) {
  return (
    dateValue(iso)?.toLocaleDateString("en-GB", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }) ?? "Choose date"
  );
}

export function stayNights({ checkIn, checkOut }: StayDates) {
  const start = dateValue(checkIn),
    end = dateValue(checkOut);
  return start && end
    ? Math.max(0, (end.getTime() - start.getTime()) / 86400000)
    : 0;
}

function StayCalendar({
  dates,
  setDates,
  today,
}: {
  dates: StayDates;
  setDates: (dates: StayDates) => void;
  today: string;
}) {
  const [month, setMonth] = useState(() => {
    const initial = dateValue(dates.checkIn) ?? dateValue(today)!;
    return new Date(
      Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1),
    );
  });
  const [field, setField] = useState<keyof StayDates>("checkIn");
  const year = month.getUTCFullYear(),
    index = month.getUTCMonth();
  const offset = (month.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const navigate = (step: number) =>
    setMonth(new Date(Date.UTC(year, index + step, 1)));
  function select(iso: string) {
    setDates(
      field === "checkIn"
        ? { checkIn: iso, checkOut: dates.checkOut > iso ? dates.checkOut : "" }
        : { ...dates, checkOut: iso },
    );
    setField(field === "checkIn" ? "checkOut" : "checkIn");
  }
  return (
    <>
      <div className="grid">
        {(["checkIn", "checkOut"] as const).map((key) => (
          <Field key={key} label={key === "checkIn" ? "Check-in" : "Check-out"}>
            <input
              type="date"
              name={key}
              required
              min={today}
              value={dates[key]}
              onFocus={() => setField(key)}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDates({ ...dates, [key]: value });
                const date = dateValue(value);
                if (date)
                  setMonth(
                    new Date(
                      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
                    ),
                  );
              }}
            />
          </Field>
        ))}
      </div>
      <div className="stay-calendar">
        <div className="stay-month">
          <button
            type="button"
            className="secondary"
            aria-label="Previous month"
            disabled={month.toISOString().slice(0, 7) <= today.slice(0, 7)}
            onClick={() => navigate(-1)}
          >
            ‹
          </button>
          <strong aria-live="polite">
            {month.toLocaleDateString("en-GB", {
              timeZone: "UTC",
              month: "long",
              year: "numeric",
            })}
          </strong>
          <button
            type="button"
            className="secondary"
            aria-label="Next month"
            onClick={() => navigate(1)}
          >
            ›
          </button>
        </div>
        <p aria-live="polite">
          Choose {field === "checkIn" ? "check-in" : "check-out"}
        </p>
        <div className="stay-days">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
            <span key={day} aria-hidden="true">
              {day}
            </span>
          ))}
          {Array.from({ length }, (_, pos) => {
            const iso = new Date(Date.UTC(year, index, pos + 1))
              .toISOString()
              .slice(0, 10);
            return (
              <button
                type="button"
                key={iso}
                aria-label={readableDate(iso)}
                style={pos === 0 ? { gridColumnStart: offset + 1 } : undefined}
                className={
                  iso > dates.checkIn && iso < dates.checkOut
                    ? "stay-night"
                    : undefined
                }
                aria-pressed={iso === dates.checkIn || iso === dates.checkOut}
                disabled={
                  iso < today || (field === "checkOut" && iso <= dates.checkIn)
                }
                onClick={() => select(iso)}
              >
                {pos + 1}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function StayPickerDialog({
  picker,
  dates,
  party,
  onDates,
  onParty,
  onClose,
  today,
}: {
  picker: StayPicker;
  dates: StayDates;
  party: StayParty;
  onDates: (value: StayDates) => void;
  onParty: (value: StayParty) => void;
  onClose: () => void;
  today: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(dates);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const nights = stayNights(draft);
  return (
    <dialog
      ref={dialog}
      className="stay-picker"
      aria-labelledby="stay-picker-title"
      onClose={onClose}
    >
      <p className="eyebrow">Stays</p>
      <h2 id="stay-picker-title">
        {picker === "dates" ? "Choose your stay dates" : "Rooms and guests"}
      </h2>
      <form
        className="stack"
        onSubmit={submit((form) => {
          const values = formData(form);
          if (picker === "dates") {
            if (!nights)
              return invalidField(
                form,
                "checkOut",
                "Check-out must be after check-in.",
              );
            onDates(draft);
          } else {
            const next = {
              rooms: Number(values.rooms),
              adults: Number(values.adults),
              children: Number(values.children),
            };
            if (next.adults + next.children > 100)
              return invalidField(
                form,
                "children",
                "Choose up to 100 guests per search.",
              );
            onParty(next);
          }
          dialog.current?.close();
        })}
      >
        {picker === "dates" ? (
          <>
            <StayCalendar dates={draft} setDates={setDraft} today={today} />
            <p>
              {nights > 0 && (
                <strong>
                  {nights} {nights === 1 ? "night" : "nights"}.{" "}
                </strong>
              )}
              Check-out day is available for the next stay.
            </p>
          </>
        ) : (
          <>
            <p>Guest names and ages are entered before you hold a room.</p>
            <Field label="Rooms">
              <input
                type="number"
                name="rooms"
                min={1}
                max={20}
                required
                defaultValue={party.rooms}
              />
            </Field>
            <Field label="Adults, age 18+">
              <input
                type="number"
                name="adults"
                min={1}
                max={100}
                required
                defaultValue={party.adults}
              />
            </Field>
            <Field label="Children, age 0–17">
              <input
                type="number"
                name="children"
                min={0}
                max={99}
                required
                defaultValue={party.children}
              />
            </Field>
          </>
        )}
        <div className="actions">
          <button className="button">
            {picker === "dates" ? "Use stay dates" : "Use rooms and guests"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
