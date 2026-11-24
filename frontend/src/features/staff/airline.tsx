"use client";

import { useState } from "react";
import { api, apiUrl } from "@/lib/api";
import {
  Action,
  Field,
  Fold,
  Form,
  PageList,
  Problem,
  Provider,
  Row,
  Section,
  amount,
  useReferences,
  useResource,
  useRevision,
} from "./ui";

const cabinTypes = ["Economy", "Premium Economy", "Business", "First"];
type Cabin = {
  _id: string;
  category: string;
  capacity: number;
  price: number;
  freeBags: number;
  bagWeightKg: number;
  booked: number;
  held: number;
  seatsRemaining?: number;
};
type Flight = {
  _id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureAt: string;
  departureDate: string;
  arrivalAt: string;
  departureLocal: string;
  arrivalLocal: string;
  status: string;
  cabins: Cabin[];
};
type Airport = { iata_code: string; name: string; time_zone: string };
type FlightBooking = {
  reference: string;
  status: string;
  passengers: string[];
  segment: { cabin: string; seats: number };
};

export function Flights({
  provider,
  manifest = false,
}: {
  provider: Provider;
  manifest?: boolean;
}) {
  const [selected, setSelected] = useState(""),
    [revision, refresh] = useRevision();
  const airports = useReferences<Airport>("/airports");
  const zones = new Map(airports.rows.map((a) => [a.iata_code, a.time_zone]));
  function departureText(f: Flight) {
    const zone = zones.get(f.departureAirport);
    if (!zone) return f.departureDate + " · " + f.departureAirport;
    return (
      new Intl.DateTimeFormat("en", {
        timeZone: zone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(f.departureAt)) +
      " · " +
      zone
    );
  }
  const path = "/airlines/" + provider._id + "/flights";
  if (selected)
    return (
      <div className="stack">
        <button
          className="secondary"
          onClick={() => {
            setSelected("");
            refresh();
          }}
        >
          ← All flights
        </button>
        <FlightPanel key={selected} id={selected} manifest={manifest} />
      </div>
    );
  return (
    <div className="stack">
      <Section title={manifest ? "Passenger manifests" : "Flight schedule"}>
        <Problem>{airports.error}</Problem>
        <PageList<Flight>
          url={path}
          revision={revision}
          empty="The assigned airline has no scheduled flights yet."
          draw={(f) => (
            <Row
              key={f._id}
              title={
                f.flightNumber +
                " · " +
                f.departureAirport +
                " → " +
                f.arrivalAirport
              }
              meta={departureText(f) + " · " + f.status}
            >
              <button className="secondary" onClick={() => setSelected(f._id)}>
                {manifest ? "Open manifest" : "Manage flight"}
              </button>
            </Row>
          )}
        />
      </Section>
      {!manifest && (
        <Section title="Schedule a flight">
          <FlightForm
            providerId={provider._id}
            after={(id) => {
              refresh();
              setSelected(id);
            }}
          />
        </Section>
      )}
    </div>
  );
}
function FlightForm({
  flight,
  providerId,
  after,
}: {
  flight?: Flight;
  providerId?: string;
  after: (id: string) => void;
}) {
  const airports = useReferences<Airport>("/airports");
  const options = airports.rows.map((a) => ({
    value: a.iata_code,
    label: a.iata_code + " · " + a.name + " · " + a.time_zone,
  }));
  return (
    <>
      <Problem>{airports.error}</Problem>
      <Form
        fields={[
          {
            name: "flightNumber",
            label: "Flight number",
            maxLength: 20,
            initial: flight?.flightNumber,
          },
          {
            name: "departureAirport",
            label: "Departure airport",
            options,
            initial: flight?.departureAirport,
          },
          {
            name: "departureLocal",
            label: "Departure (airport local time)",
            type: "datetime-local",
            initial: flight?.departureLocal?.slice(0, 16),
          },
          {
            name: "arrivalAirport",
            label: "Arrival airport",
            options,
            initial: flight?.arrivalAirport,
          },
          {
            name: "arrivalLocal",
            label: "Arrival (airport local time)",
            type: "datetime-local",
            initial: flight?.arrivalLocal?.slice(0, 16),
          },
        ]}
        submit={flight ? "Save flight" : "Create flight"}
        success="Flight saved."
        onSubmit={async (v) => {
          if (v.departureAirport === v.arrivalAirport)
            throw new Error("Departure and arrival airports must differ.");
          const updated = await api<Flight>(
            flight ? "/flights/" + flight._id : "/flights",
            {
              method: flight ? "PATCH" : "POST",
              body: flight ? v : { ...v, airlineId: providerId },
            },
          );
          after(updated._id);
        }}
      />
    </>
  );
}
function FlightPanel({ id, manifest }: { id: string; manifest: boolean }) {
  const [revision, refresh] = useRevision();
  const flight = useResource<Flight>("/flights/" + id, revision);
  if (flight.error) return <Problem>{flight.error}</Problem>;
  const f = flight.data;
  if (!f) return <p role="status">Loading flight…</p>;
  const editable =
    f.status === "Scheduled" && Date.parse(f.departureAt) > Date.now();
  return (
    <div className="stack">
      <Section
        title={
          f.flightNumber + " · " + f.departureAirport + " → " + f.arrivalAirport
        }
      >
        <p>
          {f.status} · {f.departureLocal?.replace("T", " ")} to{" "}
          {f.arrivalLocal?.replace("T", " ")}
        </p>
        {!manifest && editable && (
          <Fold title="Edit schedule">
            <FlightForm flight={f} after={refresh} />
          </Fold>
        )}
        {!manifest && editable && (
          <Action
            label="Cancel flight"
            confirmation={
              "Cancel " +
              f.flightNumber +
              " and request refunds for affected confirmed passengers?"
            }
            act={async () => {
              await api("/flights/" + id + "/cancel", {
                method: "POST",
                body: { confirm: true },
              });
              refresh();
            }}
          />
        )}
      </Section>
      <Section title="Cabin inventory">
        {f.cabins.map((c) => (
          <Row
            key={c._id}
            title={c.category + " · " + amount(c.price)}
            meta={
              (c.seatsRemaining ?? c.capacity - c.booked - c.held) +
              " seats remaining of " +
              c.capacity
            }
          >
            <p>
              {c.booked} booked · {c.held} held · {c.freeBags} included bags up
              to {c.bagWeightKg} kg each
            </p>
            {!manifest && editable && (
              <Fold title={"Edit " + c.category}>
                <CabinForm flight={f} cabin={c} after={refresh} />
              </Fold>
            )}
          </Row>
        ))}
        {!f.cabins.length && <p className="muted">No cabins configured.</p>}
        {!manifest && editable && f.cabins.length < cabinTypes.length && (
          <Fold title="Add cabin">
            <CabinForm flight={f} after={refresh} />
          </Fold>
        )}
      </Section>
      <Section title="Passenger manifest">
        <a
          className="button"
          href={apiUrl("/flights/" + id + "/passengers/export")}
          download
        >
          Download confirmed passengers (.csv)
        </a>
        <PageList<FlightBooking>
          url={"/flights/" + id + "/bookings"}
          revision={revision}
          empty="No confirmed or cancelled bookings for this flight."
          draw={(b, i) => (
            <Row
              key={b.reference || i}
              title={b.reference || "Booking"}
              meta={
                b.status +
                " · " +
                b.segment.cabin +
                " · " +
                b.segment.seats +
                " seats"
              }
            >
              <p>{b.passengers.join(", ")}</p>
            </Row>
          )}
        />
      </Section>
    </div>
  );
}
function CabinForm({
  flight,
  cabin,
  after,
}: {
  flight: Flight;
  cabin?: Cabin;
  after: () => void;
}) {
  const numbers: Field[] = [
    {
      name: "capacity",
      label: "Seat capacity",
      min: 1,
      max: 1000,
      initial: cabin?.capacity,
    },
    {
      name: "price",
      label: "Fare (USD)",
      min: 0.01,
      step: ".01",
      initial: cabin?.price,
    },
    {
      name: "freeBags",
      label: "Included bags",
      min: 0,
      max: 10,
      initial: cabin?.freeBags ?? 0,
    },
    {
      name: "bagWeightKg",
      label: "Maximum kg per bag",
      min: 0.01,
      max: 100,
      step: ".01",
      initial: cabin?.bagWeightKg ?? 23,
    },
  ];
  const options = cabinTypes.filter(
    (v) => !flight.cabins.some((c) => c.category === v && c._id !== cabin?._id),
  );
  return (
    <Form
      fields={[
        { name: "category", label: "Cabin", options, initial: cabin?.category },
        ...numbers.map((f) => ({ ...f, type: "number" })),
      ]}
      submit={cabin ? "Save cabin" : "Add cabin"}
      success="Cabin saved."
      onSubmit={async (v) => {
        const body = {
          category: v.category,
          capacity: Number(v.capacity),
          price: Number(v.price),
          freeBags: Number(v.freeBags),
          bagWeightKg: Number(v.bagWeightKg),
        };
        await api(
          "/flights/" + flight._id + "/cabins" + (cabin ? "/" + cabin._id : ""),
          { method: cabin ? "PATCH" : "POST", body },
        );
        after();
      }}
    />
  );
}
