"use client";

import { useState } from "react";
import { useWorkspaceSection } from "./ui";
import { api } from "@/lib/api";
import {
  Action,
  Field,
  Fold,
  Form,
  Page,
  PageList,
  Problem,
  Provider,
  Row,
  Section,
  Tabs,
  Values,
  amount,
  isoDate,
  query,
  useReferences,
  useResource,
  useRevision,
} from "./ui";
import { ProviderForm } from "./provider";

const roles = ["Admin", "AirlineModerator", "HotelModerator", "User"];
const roleLabels: Record<string, string> = {
  Admin: "Administrator",
  AirlineModerator: "Airline moderator",
  HotelModerator: "Hotel moderator",
  User: "Traveler",
};
const statuses = ["Active", "Suspended", "Deactivated"];
const bookingStates = [
  "Pending Payment",
  "Confirmed",
  "Completed",
  "Expired",
  "Cancelled",
];
const password: Field = {
  name: "temporaryPassword",
  label: "Temporary password",
  type: "password",
  pattern: "(?=.*[A-Za-z])(?=.*[0-9]).{8,128}",
  placeholder: "8+ characters with a letter and a digit",
};
type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  registrationDate: string;
  providerId?: string;
};
type Report = {
  _id: string;
  reason: string;
  contentType: string;
  contentId: string;
  userId: string;
  createdAt: string;
};
type Audit = {
  _id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorId: string;
  createdAt: string;
};
type Booking = {
  _id: string;
  reference?: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  userId: string;
  providerIds: string[];
  startsAt: string;
  endsAt: string;
};
type Metric = {
  providerId: string;
  providerName: string;
  bookings: number;
  grossPayments: number;
  refunds: number;
  netRevenue: number;
  currency: string;
};
const tabs = [
  "Overview",
  "Accounts",
  "Providers",
  "Bookings",
  "Reports",
  "Analytics",
  "Audit log",
];
function localeDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function AdminWorkspace() {
  const [tab, setTab] = useWorkspaceSection(tabs);
  return (
    <>
      <header className="staffHeading">
        <p className="eyebrow">Administration</p>
        <h1>Platform operations</h1>
      </header>
      <Tabs items={tabs} current={tab} choose={setTab} />
      {tab === "Overview" ? (
        <Overview go={setTab} />
      ) : tab === "Accounts" ? (
        <Accounts />
      ) : tab === "Providers" ? (
        <Providers />
      ) : tab === "Bookings" ? (
        <Bookings />
      ) : tab === "Reports" ? (
        <Reports />
      ) : tab === "Analytics" ? (
        <Analytics />
      ) : (
        <AuditLog />
      )}
    </>
  );
}
function Overview({ go }: { go: (tab: string) => void }) {
  const accounts = useResource<Page<Account>>("/admin/accounts");
  const reports = useResource<Page<Report>>("/admin/reports");
  const bookings = useResource<Page<Booking>>("/admin/bookings");
  const tiles = [
    ["Accounts", accounts],
    ["Bookings", bookings],
    ["Reports", reports],
  ] as const;
  return (
    <div className="stack">
      <div className="staffMetrics">
        {tiles.map(([label, r]) => (
          <button className="staffMetric" key={label} onClick={() => go(label)}>
            <span>{label === "Reports" ? "Open reports" : label}</span>
            <strong>
              {r.loading ? "…" : (r.data?.total ?? "Unavailable")}
            </strong>
            <span>{r.error || "View " + label.toLowerCase() + " →"}</span>
          </button>
        ))}
      </div>
      <Section title="Exchange rates">
        <Action
          label="Refresh exchange rates"
          act={() => api("/admin/exchange-rates/refresh", { method: "POST" })}
          success="The latest rates have been saved."
        />
      </Section>
    </div>
  );
}
function Accounts() {
  const [revision, refresh] = useRevision(),
    [filters, setFilters] = useState<Values>({});
  const providers = useReferences<Provider>("/admin/providers");
  return (
    <div className="stack">
      <Section title="People and permissions">
        <Form
          fields={[
            { name: "q", label: "Name or email", optional: true },
            {
              name: "role",
              label: "Role",
              optional: true,
              options: roles.map((value) => ({
                value,
                label: roleLabels[value],
              })),
            },
            {
              name: "status",
              label: "Status",
              optional: true,
              options: statuses,
            },
          ]}
          submit="Apply filters"
          onSubmit={setFilters}
        />
        <PageList<Account>
          url={"/admin/accounts?" + query(filters)}
          revision={revision}
          empty="No accounts match these filters."
          draw={(u) => (
            <Row
              key={u.id}
              title={u.name}
              meta={u.email + " · " + roleLabels[u.role] + " · " + u.status}
            >
              <p>
                Joined {localeDate(u.registrationDate)}
                {u.providerId &&
                  " · " +
                    (providers.rows.find((p) => p._id === u.providerId)?.name ||
                      u.providerId)}
              </p>
              {u.role !== "Admin" && u.status !== "Deactivated" && (
                <Fold title={"Manage " + u.name}>
                  <Action
                    label={
                      u.status === "Suspended"
                        ? "Reactivate account"
                        : "Suspend account"
                    }
                    confirmation={
                      (u.status === "Suspended" ? "Restore" : "Suspend") +
                      " access for " +
                      u.name +
                      "?"
                    }
                    act={async () => {
                      await api(
                        "/admin/accounts/" +
                          u.id +
                          "/" +
                          (u.status === "Suspended" ? "reactivate" : "suspend"),
                        { method: "PATCH" },
                      );
                      refresh();
                    }}
                  />
                  <Form
                    fields={[password]}
                    submit="Reset account password"
                    confirmation={
                      "Reset " +
                      u.name +
                      "’s password and sign out their existing sessions?"
                    }
                    reset
                    success="Temporary password saved."
                    onSubmit={(v) =>
                      api("/admin/users/" + u.id + "/reset-password", {
                        method: "POST",
                        body: v,
                      })
                    }
                  />
                </Fold>
              )}
            </Row>
          )}
        />
      </Section>
      <Section title="Create assigned moderator">
        <Problem>{providers.error}</Problem>
        <Form
          fields={[
            { name: "name", label: "Full name", maxLength: 100 },
            { name: "email", label: "Email", type: "email" },
            password,
            {
              name: "providerId",
              label: "Assigned provider",
              options: providers.rows.map((p) => ({
                value: p._id,
                label: p.name + " · " + p.type,
              })),
            },
          ]}
          submit="Create moderator"
          reset
          success="Moderator account created."
          onSubmit={async (v) => {
            const p = providers.rows.find((p) => p._id === v.providerId);
            if (!p) throw new Error("Choose a provider first.");
            await api("/admin/moderators", {
              method: "POST",
              body: {
                ...v,
                role:
                  p.type === "airline" ? "AirlineModerator" : "HotelModerator",
              },
            });
            refresh();
          }}
        />
      </Section>
    </div>
  );
}
function Providers() {
  const [type, setType] = useState<"airline" | "hotel">("airline"),
    [revision, refresh] = useRevision();
  return (
    <div className="stack">
      <Section title="Provider directory">
        <PageList<Provider>
          url="/admin/providers"
          revision={revision}
          empty="No providers have been created yet."
          draw={(p) => (
            <Row
              key={p._id}
              title={p.name}
              meta={p.type + " · " + (p.active ? "Active" : "Inactive")}
            >
              <Action
                label={p.active ? "Deactivate provider" : "Reactivate provider"}
                confirmation={
                  (p.active ? "Deactivate " : "Reactivate ") +
                  p.name +
                  "? Existing confirmed bookings stay valid."
                }
                act={async () => {
                  await api(
                    "/admin/providers/" +
                      p.type +
                      "/" +
                      p._id +
                      "/" +
                      (p.active ? "deactivate" : "reactivate"),
                    { method: "PATCH" },
                  );
                  refresh();
                }}
              />
            </Row>
          )}
        />
      </Section>
      <Section title="New provider">
        <label className="field">
          Provider type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="airline">Airline</option>
            <option value="hotel">Hotel</option>
          </select>
        </label>
        <ProviderForm key={type} type={type} after={refresh} />
      </Section>
    </div>
  );
}
function Bookings() {
  const [filters, setFilters] = useState<Values>({});
  const providers = useReferences<Provider>("/admin/providers");
  return (
    <Section title="Booking inspection">
      <Form
        submit="Filter bookings"
        fields={[
          {
            name: "type",
            label: "Booking type",
            options: ["flight", "hotel"],
            optional: true,
          },
          {
            name: "status",
            label: "Status",
            options: bookingStates,
            optional: true,
          },
          {
            name: "from",
            label: "Start date from",
            type: "date",
            optional: true,
          },
          {
            name: "to",
            label: "Start date through",
            type: "date",
            optional: true,
          },
        ]}
        onSubmit={setFilters}
      />
      <PageList<Booking>
        url={"/admin/bookings?" + query(filters)}
        empty="No bookings match this period."
        draw={(b) => (
          <Row
            key={b._id}
            title={b.reference || "Awaiting reference"}
            meta={
              b.type + " · " + b.status + " · " + amount(b.amount, b.currency)
            }
          >
            <p>
              {localeDate(b.startsAt)} – {localeDate(b.endsAt)}
            </p>
            <p>
              Providers ·{" "}
              {b.providerIds
                .map(
                  (id) => providers.rows.find((p) => p._id === id)?.name || id,
                )
                .join(", ")}
            </p>
            <p>Traveler ID · {b.userId}</p>
          </Row>
        )}
      />
    </Section>
  );
}
function Reports() {
  const [revision, refresh] = useRevision();
  return (
    <div className="stack">
      <Section title="Open reports">
        <PageList<Report>
          url="/admin/reports"
          revision={revision}
          empty="There are no open reports."
          draw={(r) => (
            <Row
              key={r._id}
              title={r.reason}
              meta={r.contentType + " · " + localeDate(r.createdAt)}
            >
              <p>Content ID · {r.contentId}</p>
              <Form
                fields={[
                  {
                    name: "action",
                    label: "Resolution",
                    options: [
                      { value: "dismiss", label: "Dismiss report" },
                      { value: "hide", label: "Hide content" },
                      { value: "delete", label: "Delete content permanently" },
                    ],
                  },
                ]}
                submit="Resolve report"
                onSubmit={async (v) => {
                  if (
                    !window.confirm(
                      "Resolve this report with the selected action: " +
                        v.action +
                        "?",
                    )
                  )
                    return;
                  await api("/admin/reports/" + r._id, {
                    method: "PATCH",
                    body: v,
                  });
                  refresh();
                }}
              />
            </Row>
          )}
        />
      </Section>
      <Section title="Moderate content by ID">
        <Form
          fields={[
            {
              name: "type",
              label: "Content type",
              options: ["post", "comment", "review", "itinerary"],
            },
            { name: "id", label: "Content ID", pattern: "[a-fA-F0-9]{24}" },
            {
              name: "action",
              label: "Action",
              options: ["Hide", "Restore", "Delete permanently"],
            },
          ]}
          submit="Apply moderation"
          confirmation="Apply the chosen action to this content? Permanent deletion cannot be undone."
          success="Moderation action recorded."
          onSubmit={async (v) => {
            await api(
              "/admin/content/" + v.type + "/" + v.id,
              v.action === "Delete permanently"
                ? { method: "DELETE", body: { confirm: true } }
                : { method: "PATCH", body: { hidden: v.action === "Hide" } },
            );
            refresh();
          }}
        />
      </Section>
    </div>
  );
}
function Analytics() {
  const [period, setPeriod] = useState<Values>({
    from: isoDate(-29),
    to: isoDate(),
  });
  return (
    <Section title="Provider performance">
      <Form
        submit="Update period"
        fields={[
          {
            name: "from",
            label: "From (UTC)",
            type: "date",
            initial: period.from,
          },
          {
            name: "to",
            label: "Through (UTC)",
            type: "date",
            initial: period.to,
          },
        ]}
        onSubmit={(v) => {
          if (v.to < v.from)
            throw new Error("End date must follow start date.");
          setPeriod(v);
        }}
      />
      <p className="muted">
        Bookings created during the selected dates and their settled payments
        and refunds.
      </p>
      <PageList<Metric>
        url={"/admin/analytics?" + query(period)}
        empty="No bookings were created during this period."
        draw={(m) => (
          <Row
            key={m.providerId}
            title={m.providerName}
            meta={m.bookings + " bookings"}
          >
            <dl className="staffLedger">
              <dt>Gross payments</dt>
              <dd>{amount(m.grossPayments, m.currency)}</dd>
              <dt>Refunds</dt>
              <dd>{amount(m.refunds, m.currency)}</dd>
              <dt>Net revenue</dt>
              <dd>{amount(m.netRevenue, m.currency)}</dd>
            </dl>
          </Row>
        )}
      />
    </Section>
  );
}
function AuditLog() {
  return (
    <Section title="Audit trail">
      <PageList<Audit>
        url="/admin/audit-logs"
        empty="There are no administrative actions yet."
        draw={(a) => (
          <Row
            key={a._id}
            title={a.action}
            meta={new Date(a.createdAt).toLocaleString()}
          >
            <p>
              {a.targetType} · {a.targetId}
            </p>
            <p>Administrator · {a.actorId}</p>
          </Row>
        )}
      />
    </Section>
  );
}
