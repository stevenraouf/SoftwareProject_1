"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import {
  allPages,
  Editor,
  failure,
  choices,
  type Author,
  type Field,
  type Option,
} from "./shared";

export interface Activity {
  _id: string;
  name: string;
  description: string;
  time?: string;
  cost: number;
  currency: string;
  imageIds: string[];
}
export interface Entry {
  _id: string;
  category: string;
  amount: number;
  currency: string;
}
export interface Day {
  _id: string;
  city: string;
  notes: string;
  number: number;
  date: string;
  activities: Activity[];
  budgets: Entry[];
}
export interface Transport {
  _id: string;
  mode: string;
  fromCity: string;
  toCity: string;
  dayId: string;
  amount: number;
  currency: string;
}
export interface CityGroup {
  city: string;
  firstDayId: string;
  firstDate: string;
  lastDate: string;
  dayCount: number;
  dayIds: string[];
  subtotal: number;
}
export interface Plan {
  _id: string;
  title: string;
  userId: string;
  author: Author;
  originalAuthor?: Author;
  countries: string[];
  startDate: string;
  visibility: "Public" | "Private";
  days: Day[];
  cityGroups: CityGroup[];
  transportCosts: Transport[];
  bookingLinks?: { bookingId: string; dayId: string }[];
  budget: {
    available: boolean;
    message?: string;
    currency: string;
    rateDate?: string;
    total: number;
    categories: Record<string, number>;
    days: { dayId: string; number: number; date: string; total: number }[];
    cityGroups: CityGroup[];
  };
}
export interface Row {
  id?: string;
  _id?: string;
  title: string;
  days: number | Day[];
  countries: string[];
  startDate: string;
  visibility?: string;
}
interface References {
  countries: Option[];
  cities: Option[];
  currencies: Option[];
  airports: Option[];
  attractions: { city_id: string; name: string }[];
}
const blank: References = {
  countries: [],
  cities: [],
  currencies: [],
  airports: [],
  attractions: [],
};
const RefContext = createContext<References>(blank);
export const useRefs = () => useContext(RefContext);
export const findLabel = (options: Option[], value: string) =>
  options.find((x) => x.value === value)?.label || value;
export const budgetCategory = (name: string) =>
  ({
    InCityTransport: "In-city transport",
    IntercityTransport: "Intercity transport",
  })[name] || name;

export function ReferencesProvider({ children }: { children: ReactNode }) {
  const [refs, setRefs] = useState<References>(blank),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([
      allPages<{ code: string; name: string }>("/countries"),
      allPages<{ city_id: string; name: string }>("/cities"),
      api<string[]>("/currencies"),
      allPages<{ iata_code: string; name: string }>("/airports"),
      allPages<{ city_id: string; name: string }>("/attractions"),
    ])
      .then(([countries, cities, currencies, airports, attractions]) => {
        if (active) {
          setRefs({
            countries: countries.map((x) => ({ value: x.code, label: x.name })),
            cities: cities.map((x) => ({ value: x.city_id, label: x.name })),
            currencies: choices(currencies),
            airports: airports.map((x) => ({
              value: x.iata_code,
              label: x.name + " (" + x.iata_code + ")",
            })),
            attractions,
          });
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(failure(e));
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <RefContext.Provider value={refs}>
      {error && (
        <p className="notice" role="alert">
          Destination lists are unavailable. {error}{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {children}
    </RefContext.Provider>
  );
}

export function PlanForm({
  plan,
  saved,
}: {
  plan?: Plan;
  saved: (id: string) => void;
}) {
  const refs = useRefs();
  const fields: Field[] = [
    {
      name: "title",
      label: "Itinerary title",
      required: true,
      maxLength: 100,
      initial: plan?.title,
    },
    {
      name: "startDate",
      label: "Start date",
      type: "date",
      required: true,
      initial: plan?.startDate,
    },
    {
      name: "countries",
      label: "Countries",
      type: "multiple",
      required: true,
      options: refs.countries,
      initial: plan?.countries,
      hint: "Choose one or more countries. On desktop, hold Ctrl or Command to select several.",
    },
  ];
  if (plan)
    fields.push({
      name: "visibility",
      label: "Who can see this plan?",
      type: "select",
      options: choices(["Private", "Public"]),
      required: true,
      initial: plan.visibility,
    });
  return (
    <Editor
      fields={fields}
      action={plan ? "Save itinerary" : "Create private itinerary"}
      onSave={async (v, raw) => {
        const body = {
          title: v.title,
          startDate: v.startDate,
          countries: raw.getAll("countries").map(String),
          ...(plan ? { visibility: v.visibility } : {}),
        };
        const record = await api<Plan>(
          plan ? "/itineraries/" + plan._id : "/itineraries",
          { method: plan ? "PATCH" : "POST", body },
        );
        saved(record._id);
      }}
    />
  );
}
