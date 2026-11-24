"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import {
  Action,
  cash,
  choices,
  Editor,
  Media,
  Pager,
  type Field,
} from "./shared";
import {
  budgetCategory,
  findLabel,
  useRefs,
  type Activity,
  type Day,
  type Entry,
  type Plan,
  type Transport,
} from "./planner-data";

export function DayForm({
  planId,
  day,
  reload,
}: {
  planId: string;
  day?: Day;
  reload: () => void;
}) {
  const refs = useRefs();
  return (
    <Editor
      fields={[
        {
          name: "city",
          label: "City",
          type: "select",
          options: refs.cities,
          required: true,
          initial: day?.city,
        },
        {
          name: "notes",
          label: "Day notes",
          type: "textarea",
          initial: day?.notes,
          maxLength: 10000,
        },
      ]}
      action={day ? "Save day" : "Add day"}
      done={day ? "Day updated." : "Day added."}
      onSave={async (v) => {
        await api(
          "/itineraries/" + planId + "/days" + (day ? "/" + day._id : ""),
          { method: day ? "PATCH" : "POST", body: v },
        );
        reload();
      }}
    />
  );
}

function Remove({
  path,
  what,
  reload,
}: {
  path: string;
  what: string;
  reload: () => void;
}) {
  return (
    <Action
      confirmText={
        "Delete " + what + "? This also updates the itinerary budget."
      }
      perform={async () => {
        await api(path, { method: "DELETE", body: { confirm: true } });
        reload();
      }}
    >
      Delete {what}
    </Action>
  );
}

function ActivityForm({
  base,
  item,
  reload,
}: {
  base: string;
  item?: Activity;
  reload: () => void;
}) {
  const refs = useRefs();
  const fields: Field[] = [
    {
      name: "name",
      label: "Activity name",
      required: true,
      maxLength: 150,
      initial: item?.name,
    },
    {
      name: "time",
      label: "Time (optional)",
      type: "time",
      initial: item?.time,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      maxLength: 10000,
      initial: item?.description,
    },
    {
      name: "cost",
      label: "Cost (optional)",
      type: "number",
      min: 0,
      max: 100000000,
      step: "0.01",
      initial: item?.cost,
    },
    {
      name: "currency",
      label: "Currency",
      type: "select",
      required: true,
      options: refs.currencies,
      initial: item?.currency || "USD",
    },
  ];
  return (
    <Editor
      fields={fields}
      action={item ? "Save activity" : "Add activity"}
      done={item ? "Activity updated." : "Activity added."}
      onSave={async (v) => {
        const body = {
          name: v.name,
          description: v.description,
          time: v.time,
          cost: Number(v.cost || 0),
          currency: v.currency,
        };
        await api(item ? "/activities/" + item._id : base, {
          method: item ? "PATCH" : "POST",
          body,
        });
        reload();
      }}
    />
  );
}

function BudgetForm({
  base,
  item,
  reload,
}: {
  base: string;
  item?: Entry;
  reload: () => void;
}) {
  const refs = useRefs();
  return (
    <Editor
      fields={[
        {
          name: "category",
          label: "Category",
          type: "select",
          required: true,
          initial: item?.category || "Food",
          options: choices([
            "Food",
            "Accommodation",
            "InCityTransport",
            "Activities",
          ]).map((o) => ({ ...o, label: budgetCategory(o.value) })),
        },
        {
          name: "amount",
          label: "Amount",
          type: "number",
          min: 0,
          step: "0.01",
          required: true,
          initial: item?.amount,
        },
        {
          name: "currency",
          label: "Currency",
          type: "select",
          options: refs.currencies,
          initial: item?.currency || "USD",
          required: true,
        },
      ]}
      action={item ? "Save expense" : "Add expense"}
      done={item ? "Expense updated." : "Expense added."}
      onSave={async (v) => {
        await api(item ? "/budgets/" + item._id : base, {
          method: item ? "PATCH" : "POST",
          body: { ...v, amount: Number(v.amount) },
        });
        reload();
      }}
    />
  );
}

function TransportForm({
  plan,
  day,
  item,
  reload,
}: {
  plan: Plan;
  day: Day;
  item?: Transport;
  reload: () => void;
}) {
  const refs = useRefs();
  return (
    <Editor
      fields={[
        {
          name: "mode",
          label: "Transport mode",
          required: true,
          maxLength: 100,
          initial: item?.mode,
          placeholder: "Train, ferry, flight…",
        },
        {
          name: "fromCity",
          label: "From city",
          type: "select",
          options: refs.cities,
          initial: item?.fromCity ?? day.city,
          required: true,
        },
        {
          name: "toCity",
          label: "To city",
          type: "select",
          options: refs.cities,
          initial: item?.toCity,
          required: true,
        },
        {
          name: "dayId",
          label: "Expense day",
          type: "select",
          required: true,
          options: plan.days.map((d) => ({
            value: d._id,
            label: "Day " + d.number + " · " + findLabel(refs.cities, d.city),
          })),
          initial: item?.dayId ?? day._id,
        },
        {
          name: "amount",
          label: "Fare",
          type: "number",
          min: 0,
          step: "0.01",
          required: true,
          initial: item?.amount,
        },
        {
          name: "currency",
          label: "Currency",
          type: "select",
          options: refs.currencies,
          initial: item?.currency || "USD",
          required: true,
        },
      ]}
      action={item ? "Save transport" : "Add transport"}
      done={item ? "Transport updated." : "Transport added."}
      onSave={async (v) => {
        await api(
          item
            ? "/transport-costs/" + item._id
            : "/itineraries/" + plan._id + "/transport-costs",
          {
            method: item ? "PATCH" : "POST",
            body: { ...v, amount: Number(v.amount) },
          },
        );
        reload();
      }}
    />
  );
}

export function DayDetails({
  plan,
  day,
  own,
  reload,
}: {
  plan: Plan;
  day: Day;
  own: boolean;
  reload: () => void;
}) {
  const refs = useRefs(),
    base = "/itineraries/" + plan._id + "/days/" + day._id;
  const [activityPage, setActivityPage] = useState(1),
    [expensePage, setExpensePage] = useState(1),
    [transportPage, setTransportPage] = useState(1);
  const transport = plan.transportCosts.filter((t) => t.dayId === day._id);
  const activities = day.activities,
    expenses = day.budgets;
  const active = (page: number, length: number) =>
    Math.max(1, Math.min(page, Math.ceil(length / 10)));
  const a = active(activityPage, activities.length),
    b = active(expensePage, expenses.length),
    t = active(transportPage, transport.length);
  const sights = refs.attractions.filter((x) => x.city_id === day.city);
  return (
    <section className="panel discovery-day" aria-label={"Day " + day.number}>
      <div className="discovery-meta">
        Day {day.number} · {day.date}
      </div>
      <h3>{findLabel(refs.cities, day.city)}</h3>
      {day.notes && <p className="discovery-prose">{day.notes}</p>}
      {sights.length > 0 && own && (
        <small>
          Nearby attractions · {sights.map((s) => s.name).join(", ")}
        </small>
      )}
      {own && (
        <details className="discovery-fold">
          <summary>Edit or move day</summary>
          <DayForm day={day} planId={plan._id} reload={reload} />
          {plan.days.length > 1 && (
            <Editor
              fields={[
                {
                  name: "position",
                  label: "Position in itinerary",
                  type: "number",
                  min: 1,
                  max: plan.days.length,
                  required: true,
                  initial: day.number,
                },
              ]}
              action="Move day"
              done="Day moved."
              onSave={async (v) => {
                const ids = plan.days
                  .map((d) => d._id)
                  .filter((id) => id !== day._id);
                ids.splice(Number(v.position) - 1, 0, day._id);
                await api("/itineraries/" + plan._id + "/days/reorder", {
                  method: "PATCH",
                  body: { dayIds: ids },
                });
                reload();
              }}
            />
          )}
          <Remove path={base} what="this day and its entries" reload={reload} />
        </details>
      )}
      <h4>Activities</h4>
      {!activities.length && <p>No activities scheduled.</p>}
      {activities.slice((a - 1) * 10, a * 10).map((item) => (
        <article className="discovery-item" key={item._id}>
          <strong>
            {item.time && item.time + " · "}
            {item.name}
          </strong>
          {item.description && (
            <p className="discovery-prose">{item.description}</p>
          )}
          {item.cost > 0 && <small>{cash(item.cost, item.currency)}</small>}
          <Media
            ids={item.imageIds || []}
            base={"/activities/" + item._id + "/images"}
            editable={own}
            reload={reload}
            label={item.name}
          />
          {own && (
            <details className="discovery-fold">
              <summary>Edit activity</summary>
              <ActivityForm
                base={base + "/activities"}
                item={item}
                reload={reload}
              />
              <Remove
                path={"/activities/" + item._id}
                what="activity"
                reload={reload}
              />
            </details>
          )}
        </article>
      ))}
      <Pager
        pages={Math.ceil(activities.length / 10)}
        page={a}
        go={setActivityPage}
      />
      {own && (
        <details className="discovery-fold">
          <summary>Add activity</summary>
          <ActivityForm base={base + "/activities"} reload={reload} />
        </details>
      )}
      <h4>Day expenses</h4>
      {expenses.slice((b - 1) * 10, b * 10).map((item) => (
        <div className="discovery-item" key={item._id}>
          <strong>{budgetCategory(item.category)}</strong>
          <p>{cash(item.amount, item.currency)}</p>
          {own && (
            <details className="discovery-fold">
              <summary>Edit expense</summary>
              <BudgetForm
                base={base + "/budgets"}
                item={item}
                reload={reload}
              />
              <Remove
                path={"/budgets/" + item._id}
                what="expense"
                reload={reload}
              />
            </details>
          )}
        </div>
      ))}
      {!expenses.length && <p>No separate budget entries.</p>}
      <Pager
        page={b}
        pages={Math.ceil(expenses.length / 10)}
        go={setExpensePage}
      />
      {own && (
        <details className="discovery-fold">
          <summary>Add expense</summary>
          <BudgetForm base={base + "/budgets"} reload={reload} />
        </details>
      )}
      {(own || transport.length > 0) && (
        <>
          <h4>Intercity transport</h4>
          {transport.slice((t - 1) * 10, t * 10).map((item) => (
            <div className="discovery-item" key={item._id}>
              <strong>{item.mode}</strong>
              <p>
                {findLabel(refs.cities, item.fromCity)} →{" "}
                {findLabel(refs.cities, item.toCity)} ·{" "}
                {cash(item.amount, item.currency)}
              </p>
              {own && (
                <details className="discovery-fold">
                  <summary>Edit transport</summary>
                  <TransportForm
                    plan={plan}
                    day={day}
                    item={item}
                    reload={reload}
                  />
                  <Remove
                    path={"/transport-costs/" + item._id}
                    what="transport"
                    reload={reload}
                  />
                </details>
              )}
            </div>
          ))}
          <Pager
            page={t}
            pages={Math.ceil(transport.length / 10)}
            go={setTransportPage}
          />
          {own && (
            <details className="discovery-fold">
              <summary>Add intercity transport</summary>
              <TransportForm plan={plan} day={day} reload={reload} />
            </details>
          )}
        </>
      )}
    </section>
  );
}
