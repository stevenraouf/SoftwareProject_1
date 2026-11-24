"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, apiUrl } from "@/lib/api";
import { useSession } from "@/lib/session";
import {
  Action,
  authorLink,
  cash,
  displayDate,
  Editor,
  LoadState,
  Pager,
  query,
  Report,
  signInLink,
  useResource,
  type Fields,
  type Page,
} from "./shared";
import {
  budgetCategory,
  findLabel,
  PlanForm,
  useRefs,
  type Plan,
  type Row,
} from "./planner-data";
import { DayDetails, DayForm } from "./day";
import { TravelTools } from "./plan-travel";

export function Planner() {
  const refs = useRefs(),
    { user } = useSession(),
    search = useSearchParams(),
    router = useRouter();
  const traveler = user?.role === "User",
    tab = search.get("section") || "public",
    page = Math.max(1, Number(search.get("page")) || 1);
  const filters = Object.fromEntries(
    ["q", "city", "country", "minDays", "maxDays"].map((k) => [
      k,
      search.get(k) || "",
    ]),
  );
  const go = (data: Fields) => router.push("/planner?" + query(data));
  const path =
    tab === "mine"
      ? traveler
        ? "/itineraries?page=" + page
        : null
      : tab === "create"
        ? null
        : "/itineraries/public/search?" +
          query({ ...filters, page: String(page) });
  const result = useResource<Page<Row>>(path);
  const member = (target: string) => (traveler ? target : signInLink(target));
  return (
    <>
      <header className="discovery-hero">
        <div>
          <span className="discovery-kicker">THE TRIP PLANNER</span>
          <h1>Your itinerary</h1>
          <p>Find a route worth following, or build your own day by day.</p>
        </div>
        <img
          src="/art/parisTower.jpg"
          alt="A view of the Eiffel Tower from the Seine"
        />
      </header>
      <nav className="discovery-tabs" aria-label="Planner views">
        <Link
          aria-current={tab === "public" ? "page" : undefined}
          href="/planner"
        >
          Public itineraries
        </Link>
        {(!user || traveler) && (
          <>
            <Link
              aria-current={tab === "mine" ? "page" : undefined}
              href={member("/planner?section=mine")}
            >
              My itineraries
            </Link>
            <Link
              aria-current={tab === "create" ? "page" : undefined}
              href={member("/planner?section=create")}
            >
              Create itinerary
            </Link>
          </>
        )}
      </nav>
      {tab === "create" ? (
        <section className="panel">
          <h2>Create an itinerary</h2>
          {traveler ? (
            <PlanForm saved={(id) => router.push("/itinerary/" + id)} />
          ) : (
            <Link href={signInLink("/planner?section=create")}>
              Sign in to create an itinerary
            </Link>
          )}
        </section>
      ) : (
        <>
          {tab === "mine" ? (
            <h2>My itineraries</h2>
          ) : (
            <section className="panel">
              <h2>Explore public itineraries</h2>
              <Editor
                key={query(filters)}
                fields={[
                  {
                    name: "q",
                    label: "Title, country or city",
                    maxLength: 100,
                    initial: filters.q,
                  },
                  {
                    name: "country",
                    label: "Country",
                    type: "select",
                    options: refs.countries,
                    initial: filters.country,
                  },
                  {
                    name: "city",
                    label: "City",
                    type: "select",
                    options: refs.cities,
                    initial: filters.city,
                  },
                  {
                    name: "minDays",
                    label: "Minimum days",
                    type: "number",
                    min: 0,
                    max: 60,
                    initial: filters.minDays,
                  },
                  {
                    name: "maxDays",
                    label: "Maximum days",
                    type: "number",
                    min: 0,
                    max: 60,
                    initial: filters.maxDays,
                  },
                ]}
                action="Search itineraries"
                onSave={async (v) => {
                  if (v.minDays && v.maxDays && +v.maxDays < +v.minDays)
                    throw new Error(
                      "Maximum days must be at least minimum days.",
                    );
                  go(v);
                }}
              />
            </section>
          )}
          {tab === "mine" && !traveler ? (
            <Link href={signInLink("/planner?section=mine")}>
              Sign in to view your itineraries
            </Link>
          ) : result.data ? (
            <>
              <div className="discovery-cards">
                {result.data.items.map((p) => {
                  const days = Array.isArray(p.days) ? p.days.length : p.days;
                  return (
                    <article className="panel" key={p.id || p._id}>
                      <p className="discovery-meta">
                        {p.countries
                          .map((c) => findLabel(refs.countries, c))
                          .join(" · ")}
                      </p>
                      <h3>
                        <Link href={"/itinerary/" + (p.id || p._id)}>
                          {p.title}
                        </Link>
                      </h3>
                      <p>
                        {days} {days === 1 ? "day" : "days"} ·{" "}
                        {displayDate(p.startDate)} · {p.visibility || "Public"}
                      </p>
                    </article>
                  );
                })}
              </div>
              {!result.data.total && (
                <p className="panel">
                  {tab === "mine"
                    ? "Your first itinerary starts with a title and a date."
                    : "No itineraries match this search. Try another destination or duration."}
                </p>
              )}
              <Pager
                page={page}
                pages={result.data.pages}
                go={(n) => go({ ...filters, section: tab, page: String(n) })}
              />
            </>
          ) : (
            <LoadState error={result.error} retry={result.reload} />
          )}
        </>
      )}
    </>
  );
}

function Budget({ plan }: { plan: Plan }) {
  const b = plan.budget,
    refs = useRefs(),
    [page, setPage] = useState(1);
  if (!b?.available)
    return (
      <section className="panel">
        <h2>Trip budget</h2>
        <p className="notice">
          {b?.message || "Currency conversion is currently unavailable."}
        </p>
      </section>
    );
  const p = Math.max(1, Math.min(page, Math.ceil(b.days.length / 10)));
  return (
    <section className="panel">
      <p className="discovery-kicker">Trip budget</p>
      <h2>{cash(b.total, b.currency)}</h2>
      <p>
        {b.rateDate
          ? "Exchange rates dated " + b.rateDate
          : "All costs are already in " + b.currency + "."}
      </p>
      <dl className="discovery-budget">
        {Object.entries(b.categories).map(([category, n]) => (
          <div key={category}>
            <dt>{budgetCategory(category)}</dt>
            <dd>{cash(n, b.currency)}</dd>
          </div>
        ))}
      </dl>
      {!!b.days.length && (
        <details className="discovery-fold">
          <summary>Day totals</summary>
          <ul className="discovery-list">
            {b.days.slice((p - 1) * 10, p * 10).map((day) => (
              <li key={day.dayId}>
                <span>
                  Day {day.number} ·{" "}
                  {findLabel(
                    refs.cities,
                    plan.days.find((d) => d._id === day.dayId)?.city || "",
                  )}{" "}
                  · {day.date}
                </span>
                <strong>{cash(day.total, b.currency)}</strong>
              </li>
            ))}
          </ul>
          <Pager page={p} pages={Math.ceil(b.days.length / 10)} go={setPage} />
        </details>
      )}
    </section>
  );
}

export function PlanPage({ id }: { id: string }) {
  const { user, loading } = useSession(),
    refs = useRefs(),
    router = useRouter();
  const result = useResource<Plan>(
    loading ? null : (user ? "/itineraries/" : "/itineraries/public/") + id,
  );
  const [page, setPage] = useState(1);
  const plan = result.data;
  if (!plan) return <LoadState error={result.error} retry={result.reload} />;
  const traveler = user?.role === "User",
    own = traveler && user?.id === plan.userId,
    b = plan.budget;
  const current = Math.max(1, Math.min(page, Math.ceil(plan.days.length / 10))),
    visible = plan.days.slice((current - 1) * 10, current * 10);
  return (
    <>
      <Link href="/planner">← Trip planner</Link>
      <header className="panel discovery-plan-header">
        <p className="discovery-kicker">
          {plan.countries.map((c) => findLabel(refs.countries, c)).join(" · ")}
        </p>
        <h1>{plan.title}</h1>
        <p>
          By {authorLink(plan.author)} · {plan.visibility} ·{" "}
          {displayDate(plan.startDate)} · {plan.days.length} days
        </p>
        {plan.originalAuthor && (
          <p>Original itinerary by {authorLink(plan.originalAuthor)}</p>
        )}
        <div className="actions">
          {own && (
            <a
              className="button secondary"
              href={apiUrl("/itineraries/" + id + "/pdf")}
            >
              Download itinerary PDF
            </a>
          )}
          {traveler && plan.visibility === "Public" && (
            <>
              <Action
                perform={async () => {
                  const copy = await api<Plan>(
                    "/itineraries/" + id + "/clone",
                    { method: "POST" },
                  );
                  router.push("/itinerary/" + copy._id);
                }}
              >
                Make a private copy
              </Action>
              <Action
                perform={async () => {
                  await api("/favourites", {
                    method: "POST",
                    body: { type: "itinerary", resourceId: id },
                  });
                }}
                success="Itinerary saved to favourites."
              >
                Save to favourites
              </Action>
            </>
          )}
          {!user && (
            <Link href={signInLink("/itinerary/" + id)}>
              Sign in to save or clone
            </Link>
          )}
        </div>
        {own && (
          <details className="discovery-fold">
            <summary>Itinerary settings</summary>
            <PlanForm
              key={
                plan.title +
                plan.visibility +
                plan.startDate +
                plan.countries.join()
              }
              plan={plan}
              saved={result.reload}
            />
            <Action
              confirmText="Delete this itinerary and all its days? Other travelers’ independent copies will remain available."
              perform={async () => {
                await api("/itineraries/" + id, {
                  method: "DELETE",
                  body: { confirm: true },
                });
                router.replace("/planner?section=mine");
              }}
            >
              Delete itinerary
            </Action>
          </details>
        )}
        {traveler && !own && <Report type="itinerary" id={id} />}
      </header>
      <Budget plan={plan} />
      <section>
        <h2>Day by day</h2>
        {!plan.days.length && (
          <p className="panel">This itinerary has no days yet.</p>
        )}
        {own && plan.days.length < 60 && (
          <details className="panel discovery-fold">
            <summary>Add a day</summary>
            <DayForm planId={id} reload={result.reload} />
          </details>
        )}
        {plan.cityGroups.map((g) => {
          const days = visible.filter((d) => g.dayIds.includes(d._id));
          if (!days.length) return null;
          const summary = b?.cityGroups?.find(
            (c) => c.firstDayId === g.firstDayId,
          );
          return (
            <section className="discovery-city" key={g.firstDayId}>
              <header>
                <h3>{findLabel(refs.cities, g.city)}</h3>
                <span>
                  {g.dayCount} {g.dayCount === 1 ? "day" : "days"} ·{" "}
                  {g.firstDate} – {g.lastDate}
                  {summary && " · " + cash(summary.subtotal, b.currency)}
                </span>
              </header>
              {days.map((day) => (
                <DayDetails
                  key={day._id}
                  day={day}
                  plan={plan}
                  own={own}
                  reload={result.reload}
                />
              ))}
            </section>
          );
        })}
        <Pager
          page={current}
          pages={Math.ceil(plan.days.length / 10)}
          go={setPage}
        />
      </section>
      {own && plan.days.length > 0 && (
        <TravelTools plan={plan} reload={result.reload} />
      )}
    </>
  );
}
