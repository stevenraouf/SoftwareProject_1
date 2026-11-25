import { findPlace } from "@/lib/destinations";

export type FlightDraft = {
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string;
  sampleDeparture: boolean;
  defaultOrigin: boolean;
  returnDate: string;
  round: boolean;
  adults: string;
  children: string;
  infants: string;
  cabin: string;
};

export function sampleDate(airport: string, today: string) {
  const sample = airport === "CAI" ? "2027-05-19" : "2027-05-12";
  if (today <= sample) return sample;
  const next = new Date(today + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + 7);
  return next.toISOString().slice(0, 10);
}

export function initialDraft(
  airport: string,
  query: URLSearchParams,
  today: string,
): FlightDraft {
  const code = (name: string, fallback: string) => {
    const value = query.get(name)?.toUpperCase() || "";
    return /^[A-Z]{3}$/.test(value) ? value : fallback;
  };
  const arrival = code("arrivalAirport", airport);
  const usualOrigin = arrival === "CAI" ? "DXB" : "CAI";
  const origin = code("departureAirport", usualOrigin);
  return {
    departureAirport: origin === arrival ? usualOrigin : origin,
    defaultOrigin: !query.has("departureAirport") || origin === arrival,
    arrivalAirport: arrival,
    departureDate: query.get("departureDate") || sampleDate(arrival, today),
    sampleDeparture: !query.get("departureDate"),
    returnDate: query.get("returnDate") || "",
    round: query.has("returnDate") || query.get("trip") === "round",
    adults: query.get("adults") || "1",
    children: query.get("children") || "0",
    infants: query.get("infants") || "0",
    cabin: query.get("cabin") || "Economy",
  };
}

export function withDestination(
  draft: FlightDraft,
  arrivalAirport: string,
  today: string,
): FlightDraft {
  if (draft.arrivalAirport === arrivalAirport) return draft;
  const useDefault =
    draft.defaultOrigin || draft.departureAirport === arrivalAirport;
  return {
    ...draft,
    arrivalAirport,
    defaultOrigin: useDefault,
    departureAirport: useDefault
      ? arrivalAirport === "CAI"
        ? "DXB"
        : "CAI"
      : draft.departureAirport,
    departureDate: draft.sampleDeparture
      ? sampleDate(arrivalAirport, today)
      : draft.departureDate,
  };
}

export function flightQuery(draft: FlightDraft) {
  const { round, returnDate, sampleDeparture, defaultOrigin, ...fields } =
    draft;
  const result = new URLSearchParams(fields);
  if (round && returnDate) result.set("returnDate", returnDate);
  return result;
}

export function portalHref(
  path: string,
  draft: FlightDraft,
  windowCode?: string,
) {
  const query = flightQuery(draft);
  if (draft.sampleDeparture) query.delete("departureDate");
  if (draft.defaultOrigin) query.delete("departureAirport");
  if (draft.adults === "1") query.delete("adults");
  if (draft.children === "0") query.delete("children");
  if (draft.infants === "0") query.delete("infants");
  if (draft.cabin === "Economy") query.delete("cabin");
  const preview = windowCode || path.split("/")[2] || "CDG";
  if (draft.arrivalAirport === preview) query.delete("arrivalAirport");
  if (windowCode && windowCode !== "CDG") query.set("window", windowCode);
  if (draft.round && !draft.returnDate) query.set("trip", "round");
  return query.size ? path + "?" + query : path;
}

export function cityName(code: string) {
  return findPlace(code)?.[2] || code;
}
