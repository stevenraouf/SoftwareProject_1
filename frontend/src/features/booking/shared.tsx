"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
  pageSize: number;
}
export interface Airport {
  iata_code: string;
  name: string;
  city_id: string;
  time_zone: string;
}
export interface Fare {
  flightId: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  airlineId: string;
  departureAt: string;
  arrivalAt: string;
  departureLocal: string;
  cabin: string;
  price: number;
  currency: string;
  durationMinutes: number;
  seatsRemaining: number;
}
export interface Tier {
  threshold: number;
  refundPercent: number;
}
export interface Cabin {
  category: string;
  price: number;
  seatsRemaining: number;
  freeBags: number;
  bagWeightKg: number;
}
export interface Flight {
  _id: string;
  flightNumber: string;
  airline: { id: string; name: string };
  departureAirport: string;
  arrivalAirport: string;
  departureLocal: string;
  arrivalLocal: string;
  cabins: Cabin[];
  cancellationTiers: Tier[];
  maxExtraBags: number;
  extraBagPrice: number;
}
export interface Room {
  _id: string;
  number: string;
  type: string;
  beds: number;
  occupancy: number;
  price: number;
  totalStayPrice: number;
  currency: string;
}
export interface Hotel {
  _id: string;
  name: string;
  city: string;
  country: string;
  starClass: number;
  imageIds: string[];
  pricePerNight: number;
  currency: string;
  address: string;
  description: string;
  amenities: string[];
  ratingCount: number;
  averageRating: number;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  cancellationTiers: Tier[];
  availableRooms?: Page<Room>;
}
export interface Passenger {
  fullName: string;
  dateOfBirth: string;
  identityNumber: string;
  type: string;
  extraBags: number;
  bagWeightsKg?: number[];
}
export interface Segment {
  flightId: string;
  flightNumber: string;
  airlineName: string;
  departureAirport: string;
  arrivalAirport: string;
  departureAt: string;
  arrivalAt: string;
  departureZone: string;
  arrivalZone: string;
  cabin: string;
  freeBags: number;
  bagWeightKg: number;
  extraBagPrice: number;
  maxExtraBags: number;
  total: number;
}
export interface StayRoom {
  roomId: string;
  number: string;
  type: string;
  guests: { name: string; age: number }[];
  total: number;
  nightlyPrice: number;
}
export interface Snapshot {
  segments?: Segment[];
  passengers?: Passenger[];
  hotelId?: string;
  hotelName?: string;
  rooms?: StayRoom[];
  checkIn?: string;
  checkOut?: string;
  timezone?: string;
}
export interface Booking {
  _id: string;
  type: "flight" | "hotel";
  status: string;
  reference: string;
  amount: number;
  currency: string;
  startsAt: string;
  endsAt: string;
  holdExpiresAt?: string;
  policyAcceptedAt?: string;
  paymentId?: string;
  snapshot: Snapshot;
  policySnapshot: Policy;
  refunds?: Refund[];
  pendingChangeId?: string;
}
export interface Policy {
  cancellationTiers: Tier[];
  segments?: Pick<
    Segment,
    | "flightId"
    | "cabin"
    | "freeBags"
    | "bagWeightKg"
    | "extraBagPrice"
    | "maxExtraBags"
  >[];
  checkInTime?: string;
  checkOutTime?: string;
  timezone?: string;
}
export interface Refund {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string;
}
export interface Review {
  _id: string;
  bookingId: string;
  userId: string;
  rating: number;
  body?: string;
  reply?: string;
  author?: { name?: string };
  createdAt: string;
}
export const cabins = ["Economy", "Premium Economy", "Business", "First"];
export function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(value);
}
export function localTime(value: string, zone?: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone || "UTC",
  }).format(new Date(value));
}
export function atAirport(value: string) {
  return value?.slice(0, 16).replace("T", " · ");
}
export function qs(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") q.set(k, String(v));
  });
  return q.toString();
}
export function formData(form: HTMLFormElement) {
  return Object.fromEntries(
    Array.from(new FormData(form), ([k, v]) => [k, String(v).trim()]),
  );
}
export function message(e: unknown) {
  if (e instanceof ApiError && e.fields?.length) {
    return e.fields
      .map(({ field, messages }) => field + ": " + messages.join(". "))
      .join(" · ");
  }
  return e instanceof Error
    ? e.message
    : "The request failed. Please try again.";
}
export function useLoad<T>(path: string | null, revision = 0) {
  const [state, set] = useState<{ key: string; data?: T; error?: string }>({
    key: "",
  });
  const key = path + "#" + revision;
  useEffect(() => {
    let alive = true;
    if (path)
      api<T>(path)
        .then((data) => {
          if (alive) set({ key, data });
        })
        .catch((e) => {
          if (alive) set({ key, error: message(e) });
        });
    return () => {
      alive = false;
    };
  }, [path, key]);
  return state.key === key ? state : { key };
}
export function useAction() {
  const lock = useRef(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(message(e));
      return e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// Use the browser's validity UI and the inline message rendered by Field.
export function invalidField(
  form: HTMLFormElement,
  name: string,
  text: string,
) {
  const controls = Array.from(
    form.querySelectorAll<Control>("input,select,textarea"),
  );
  const field = controls.find(
    (c) => c.name === name || c.dataset.apiField === name,
  );
  if (!field) return false;
  field.setCustomValidity(text);
  field.reportValidity();
  // Cross-field errors are recalculated on every submission.
  field.setCustomValidity("");
  return true;
}
export function submit(fn: (form: HTMLFormElement) => unknown) {
  return async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const error = await fn(form);
    if (error instanceof ApiError && error.fields) {
      // Report in reverse order so the first invalid field retains keyboard focus.
      for (const { field, messages } of [...error.fields].reverse()) {
        invalidField(form, field, messages.join(". "));
      }
    }
  };
}
export function ErrorLine({ text }: { text?: string }) {
  return text ? (
    <div className="notice" role="alert">
      {text}
    </div>
  ) : null;
}
export function Status({
  state,
}: {
  state: { error?: string; data?: unknown };
}) {
  return state.error ? (
    <ErrorLine text={state.error} />
  ) : !state.data ? (
    <p role="status">Loading…</p>
  ) : null;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId(),
    [error, setError] = useState("");
  return (
    <label
      className="field"
      onInvalidCapture={(event) => {
        const field = event.target as Control;
        setError(field.validationMessage);
        field.setAttribute("aria-invalid", "true");
        field.setAttribute("aria-describedby", id);
      }}
      onInput={(event) => {
        const field = event.target as Control;
        setError("");
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
      }}
    >
      <span>{label}</span>
      {children}
      {error && (
        <small className="invalid" id={id} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (n: number) => void;
}) {
  return pages > 1 ? (
    <nav aria-label="Results pages" className="actions">
      <button
        type="button"
        className="secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        type="button"
        className="secondary"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  ) : null;
}
export function Tiers({ tiers }: { tiers: Tier[] }) {
  return (
    <div>
      <h3>Cancellation terms</h3>
      {tiers.length ? (
        <ul>
          {[...tiers]
            .sort((a, b) => b.threshold - a.threshold)
            .map((t) => (
              <li key={t.threshold}>
                {t.threshold}+ days before travel · {t.refundPercent}% refund
              </li>
            ))}
        </ul>
      ) : (
        <p>No refund tiers are available.</p>
      )}
    </div>
  );
}
export function SignIn({ label = "Sign in to continue" }: { label?: string }) {
  const next =
    typeof window === "undefined"
      ? ""
      : window.location.pathname + window.location.search;
  return (
    <Link className="button" href={"/login?next=" + encodeURIComponent(next)}>
      {label}
    </Link>
  );
}
export function ticketLink(id: string, type: string) {
  return (
    "/booking/" + encodeURIComponent(id) + "?type=" + encodeURIComponent(type)
  );
}
export function allPages<T>(path: string): Promise<T[]> {
  return api<Page<T>>(path).then(async (first) => {
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) =>
        api<Page<T>>(
          path + (path.includes("?") ? "&" : "?") + "page=" + (i + 2),
        ),
      ),
    );
    return first.items.concat(...rest.map((p) => p.items));
  });
}
export function useAirports() {
  const [airports, set] = useState<Airport[]>([]);
  useEffect(() => {
    let active = true;
    allPages<Airport>("/airports")
      .then((a) => {
        if (active) set(a);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return airports;
}
