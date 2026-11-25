"use client";

import { FieldError } from "@/lib/form-errors";

import { useState } from "react";
import { api } from "@/lib/api";
import {
  Action,
  Fold,
  Form,
  PageList,
  Row,
  Section,
  amount,
  isoDate,
  query,
  useRevision,
  useRowPage,
} from "./ui";

type Range = { start: string; end: string };
type Room = {
  _id: string;
  number: string;
  type: string;
  beds: number;
  occupancy: number;
  price: number;
  active: boolean;
  everReserved: boolean;
  availability: Range[];
  blocked: Range[];
};
type RoomDay = {
  date: string;
  status: string;
  reference?: string;
  bookingStatus?: string;
};
type Reservation = {
  reference?: string;
  status: string;
  checkIn: string;
  checkOut: string;
  rooms: { number: string; guests: { name: string; age: number }[] }[];
};
type Review = {
  _id: string;
  rating: number;
  body?: string;
  author?: { id: string; name: string };
  createdAt: string;
  reply?: string;
};
export function Rooms({ id }: { id: string }) {
  const [revision, refresh] = useRevision();
  const base = "/hotels/" + id + "/rooms";
  return (
    <div className="stack">
      <Section title="Room inventory">
        <PageList<Room>
          url={base}
          revision={revision}
          empty="No rooms have been added to this hotel."
          draw={(r) => (
            <Row
              key={r._id}
              title={"Room " + r.number + " · " + r.type}
              meta={
                (r.active ? "Active" : "Inactive") +
                " · " +
                amount(r.price) +
                " per night"
              }
            >
              <p>
                {r.beds} beds · Up to {r.occupancy} guests
              </p>
              <Fold title={"Edit room " + r.number}>
                <RoomForm base={base} room={r} refresh={refresh} />
                <Action
                  label={r.active ? "Deactivate room" : "Reactivate room"}
                  confirmation={
                    (r.active ? "Deactivate" : "Reactivate") +
                    " room " +
                    r.number +
                    "?"
                  }
                  act={async () => {
                    await api(base + "/" + r._id, {
                      method: "PATCH",
                      body: { active: !r.active },
                    });
                    refresh();
                  }}
                />
                {!r.everReserved && (
                  <Action
                    label="Delete room"
                    confirmation={
                      "Permanently delete unused room " + r.number + "?"
                    }
                    act={async () => {
                      await api(base + "/" + r._id, {
                        method: "DELETE",
                        body: { confirm: true },
                      });
                      refresh();
                    }}
                  />
                )}
              </Fold>
              <Fold title="Bookable dates">
                <DateRanges
                  base={base + "/" + r._id + "/availability"}
                  kind="availability"
                  ranges={r.availability}
                  refresh={refresh}
                />
              </Fold>
              <Fold title="Blocked dates">
                <DateRanges
                  base={base + "/" + r._id + "/availability"}
                  kind="blocked"
                  ranges={r.blocked}
                  refresh={refresh}
                />
              </Fold>
            </Row>
          )}
        />
      </Section>
      <Section title="Add a room">
        <RoomForm base={base} refresh={refresh} />
      </Section>
    </div>
  );
}
function RoomForm({
  base,
  room,
  refresh,
}: {
  base: string;
  room?: Room;
  refresh: () => void;
}) {
  return (
    <Form
      fields={[
        {
          name: "number",
          label: "Room number",
          maxLength: 40,
          initial: room?.number,
        },
        {
          name: "type",
          label: "Room type",
          maxLength: 80,
          initial: room?.type,
        },
        {
          name: "beds",
          label: "Beds",
          type: "number",
          min: 1,
          max: 30,
          initial: room?.beds,
        },
        {
          name: "occupancy",
          label: "Maximum guests",
          type: "number",
          min: 1,
          max: 50,
          initial: room?.occupancy,
        },
        {
          name: "price",
          label: "Nightly price (USD)",
          type: "number",
          step: ".01",
          min: 0.01,
          initial: room?.price,
        },
      ]}
      submit={room ? "Save room" : "Create room"}
      success="Room saved."
      reset={!room}
      onSubmit={async (v) => {
        await api(base + (room ? "/" + room._id : ""), {
          method: room ? "PATCH" : "POST",
          body: {
            number: v.number,
            type: v.type,
            beds: Number(v.beds),
            occupancy: Number(v.occupancy),
            price: Number(v.price),
          },
        });
        refresh();
      }}
    />
  );
}
function DateRanges({
  base,
  kind,
  ranges,
  refresh,
}: {
  base: string;
  kind: "blocked" | "availability";
  ranges: Range[];
  refresh: () => void;
}) {
  const { rows, pager } = useRowPage(
    ranges,
    kind === "availability" ? "Bookable date pages" : "Blocked date pages",
    true,
  );
  return (
    <div className="stack">
      <p className="muted">
        The range includes the starting night and ends before the last date.
      </p>
      {rows.map((r) => (
        <div className="staffRange" key={r.start + ":" + r.end}>
          <span>
            {r.start} — {r.end}
          </span>
          <Action
            label="Remove range"
            confirmation={"Remove this " + kind + " period?"}
            act={async () => {
              await api(base, {
                method: "PATCH",
                body: {
                  kind,
                  ranges: ranges
                    .filter(
                      (range) => range.start !== r.start || range.end !== r.end,
                    )
                    .map(({ start, end }) => ({ start, end })),
                },
              });
              refresh();
            }}
          />
        </div>
      ))}
      {!ranges.length && <p>No ranges configured.</p>}
      {pager}
      <Form
        fields={[
          { name: "start", type: "date", label: "First night" },
          { name: "end", type: "date", label: "End date (exclusive)" },
        ]}
        submit={kind === "availability" ? "Add bookable dates" : "Block dates"}
        success="Dates updated."
        reset
        onSubmit={async (v) => {
          if (v.end <= v.start)
            throw new FieldError("end", "The end date must follow the first night.");
          await api(base, {
            method: "POST",
            body: { kind, ranges: [{ start: v.start, end: v.end }] },
          });
          refresh();
        }}
      />
    </div>
  );
}
function RoomCalendar({ days }: { days: RoomDay[] }) {
  const { rows, pager } = useRowPage(days, "Nightly availability pages");
  return (
    <>
      <ul className="staffCalendar">
        {rows.map((d) => (
          <li key={d.date} data-state={d.status}>
            <time dateTime={d.date}>{d.date}</time>
            <strong>{d.status}</strong>
            {d.reference && (
              <span>
                {d.reference} · {d.bookingStatus}
              </span>
            )}
          </li>
        ))}
      </ul>
      {pager}
    </>
  );
}

export function Availability({ id }: { id: string }) {
  const [range, setRange] = useState({ start: isoDate(), end: isoDate(7) });
  return (
    <Section title="Room availability">
      <Form
        fields={[
          {
            name: "start",
            label: "First night",
            type: "date",
            initial: range.start,
          },
          {
            name: "end",
            label: "End date (exclusive)",
            type: "date",
            initial: range.end,
          },
        ]}
        submit="View availability"
        onSubmit={(v) => {
          if (v.end <= v.start)
            throw new FieldError("end", "Choose an end date after the first night.");
          setRange({ start: v.start, end: v.end });
        }}
      />
      <PageList<{ roomId: string; number: string; days: RoomDay[] }>
        url={"/hotels/" + id + "/availability?" + query(range)}
        empty="No rooms at this property."
        draw={(r) => (
          <Row key={r.roomId} title={"Room " + r.number}>
            <RoomCalendar days={r.days} />
          </Row>
        )}
      />
    </Section>
  );
}
function ReservationRooms({ rooms }: { rooms: Reservation["rooms"] }) {
  const { rows, pager } = useRowPage(rooms, "Reserved room pages");
  return (
    <>
      {rows.map((room) => (
        <p key={room.number}>
          Room {room.number} · {room.guests.map((g) => g.name).join(", ")}
        </p>
      ))}
      {pager}
    </>
  );
}

export function Reservations({ id }: { id: string }) {
  return (
    <Section title="Guest reservations">
      <PageList<Reservation>
        url={"/hotels/" + id + "/reservations"}
        empty="There are no reservations for this hotel."
        draw={(r, i) => (
          <Row
            key={r.reference || i}
            title={r.reference || "Awaiting confirmation"}
            meta={r.status + " · " + r.checkIn + " to " + r.checkOut}
          >
            <ReservationRooms rooms={r.rooms} />
          </Row>
        )}
      />
    </Section>
  );
}
export function Reviews({ id }: { id: string }) {
  const [revision, refresh] = useRevision();
  return (
    <Section title="Guest reviews">
      <PageList<Review>
        url={"/hotels/" + id + "/reviews"}
        revision={revision}
        empty="This property has no published guest reviews yet."
        draw={(r) => (
          <Row
            key={r._id}
            title={(r.author?.name || "Guest") + " · " + r.rating + "/5"}
            meta={new Date(r.createdAt).toLocaleDateString()}
          >
            {r.body && <p>{r.body}</p>}
            {r.reply && <blockquote>{r.reply}</blockquote>}
            <Fold title={r.reply ? "Edit hotel reply" : "Reply to guest"}>
              <Form
                fields={[
                  {
                    name: "body",
                    type: "textarea",
                    label: "Public hotel reply",
                    maxLength: 1000,
                    initial: r.reply,
                  },
                ]}
                submit="Publish reply"
                success="Hotel reply published."
                onSubmit={async (v) => {
                  await api("/reviews/" + r._id + "/reply", {
                    method: "POST",
                    body: v,
                  });
                  refresh();
                }}
              />
            </Fold>
          </Row>
        )}
      />
    </Section>
  );
}
