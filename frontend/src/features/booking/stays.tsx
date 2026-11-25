"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, apiUrl } from "@/lib/api";
import { useSession } from "@/lib/session";
import {
  allPages,
  invalidField,
  ErrorLine,
  Field,
  formData,
  money,
  Pager,
  qs,
  SignIn,
  Status,
  submit,
  Tiers,
  ticketLink,
  useAction,
  useLoad,
  type Page,
  type Hotel,
  type Room,
  type Review,
  type Booking,
} from "./shared";

const criteria = [
  "destination",
  "checkIn",
  "checkOut",
  "guests",
  "rooms",
  "minPrice",
  "maxPrice",
  "minRating",
  "sort",
  "page",
];
function validStayDates(form: HTMLFormElement, timeZone = "Etc/GMT+12") {
  const { checkIn, checkOut } = formData(form);
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (checkIn < today) {
    invalidField(form, "checkIn", "Check-in cannot be in the past.");
    return false;
  }
  if (checkOut <= checkIn) {
    invalidField(form, "checkOut", "Check-out must be after check-in.");
    return false;
  }
  return true;
}
export function StaySearch() {
  const q = useSearchParams(),
    router = useRouter(),
    params = Object.fromEntries(criteria.map((k) => [k, q.get(k) || ""])),
    str = qs(params);
  const active = !!(params.destination && params.checkIn && params.checkOut);
  const result = useLoad<Page<Hotel>>(active ? "/hotels/search?" + str : null);
  return (
    <main className="booking-view stack">
      <header className="stay-hero">
        <div>
          <p className="eyebrow">Stays</p>
          <h1>Find a place to stay</h1>
          <p>Search by city or country and choose rooms for your whole stay.</p>
        </div>
        <img
          src="/art/hotelRoom.jpg"
          alt="Sunlit guest room opening onto a garden"
        />
      </header>
      <form
        className="panel stack"
        key={str}
        onSubmit={submit((f) => {
          if (!validStayDates(f)) return;
          const values = formData(f);
          if (
            values.minPrice &&
            values.maxPrice &&
            Number(values.maxPrice) < Number(values.minPrice)
          )
            return invalidField(
              f,
              "maxPrice",
              "Maximum nightly price must be at least the minimum price.",
            );
          router.push("/stays?" + qs(values));
        })}
      >
        <div className="grid">
          <Field label="Destination">
            <input
              required
              name="destination"
              placeholder="City or country"
              defaultValue={params.destination}
            />
          </Field>
          {["checkIn", "checkOut"].map((k, i) => (
            <Field key={k} label={i ? "Check-out" : "Check-in"}>
              <input type="date" required name={k} defaultValue={params[k]} />
            </Field>
          ))}
          {["guests", "rooms"].map((k, i) => (
            <Field key={k} label={i ? "Rooms" : "Guests"}>
              <input
                name={k}
                type="number"
                min={1}
                max={i ? 20 : 100}
                defaultValue={params[k] || 1}
                required
              />
            </Field>
          ))}
        </div>
        <details
          open={!!(params.minPrice || params.maxPrice || params.minRating)}
        >
          <summary>Nightly price, guest rating &amp; sorting</summary>
          <div className="grid">
            {["minPrice", "maxPrice"].map((k, i) => (
              <Field
                key={k}
                label={(i ? "Maximum" : "Minimum") + " nightly price"}
              >
                <input
                  name={k}
                  type="number"
                  min="0"
                  step=".01"
                  defaultValue={params[k]}
                />
              </Field>
            ))}
            <Field label="Minimum guest rating">
              <select name="minRating" defaultValue={params.minRating}>
                <option value="">All ratings</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="Sort by">
              <select name="sort" defaultValue={params.sort || "price"}>
                <option value="price">Lowest nightly rate</option>
                <option value="rating">Guest rating</option>
              </select>
            </Field>
          </div>
        </details>
        <button className="button">Search stays →</button>
      </form>
      {active && <Status state={result} />}{" "}
      {result.data && (
        <section className="stack">
          <h2>
            {result.data.total} {result.data.total === 1 ? "stay" : "stays"} in{" "}
            {params.destination}
          </h2>
          {result.data.items.length === 0 && (
            <p className="panel">No stays found for these rooms and dates.</p>
          )}
          {result.data.items.map((h) => (
            <article className="panel fare-row" key={h._id}>
              <div>
                {h.imageIds?.[0] && (
                  <img
                    className="property-image"
                    crossOrigin="use-credentials"
                    alt={h.name}
                    src={apiUrl("/media/" + h.imageIds[0])}
                  />
                )}
                <p className="muted">
                  {h.city} · {h.country} · {h.starClass} stars
                </p>
                <h3>{h.name}</h3>
                <p>
                  {h.ratingCount
                    ? h.averageRating.toFixed(1) +
                      " / 5 from " +
                      h.ratingCount +
                      " ratings"
                    : "No ratings yet"}
                </p>
              </div>
              <div>
                <strong>
                  From {money(h.pricePerNight, h.currency)} / night
                </strong>
                <p>
                  <Link className="button" href={"/hotel/" + h._id + "?" + str}>
                    Choose rooms →
                  </Link>
                </p>
              </div>
            </article>
          ))}
          <Pager
            page={result.data.page}
            pages={result.data.pages}
            onPage={(page) => router.push("/stays?" + qs({ ...params, page }))}
          />
        </section>
      )}
    </main>
  );
}
function HotelReviews({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    [report, setReport] = useState(""),
    [revision, reload] = useState(0),
    [notice, setNotice] = useState("");
  const reviews = useLoad<Page<Review>>(
      "/hotels/" + id + "/reviews?page=" + page,
      revision,
    ),
    me = useLoad<{ id: string; role: string }>("/auth/me"),
    action = useAction();
  return (
    <section className="panel stack">
      <h2>Guest reviews</h2>
      <Status state={reviews} />
      {reviews.data?.items.map((r) => (
        <article className="review-row" key={r._id}>
          <strong>
            {r.author?.name || "Traveler"} · {r.rating}/5
          </strong>
          <p>{r.body}</p>
          {r.reply && <blockquote>Hotel reply · {r.reply}</blockquote>}
          {me.data?.role === "User" && me.data.id !== r.userId && (
            <button className="secondary" onClick={() => setReport(r._id)}>
              Report review
            </button>
          )}
          {report === r._id && (
            <form
              className="stack"
              onSubmit={submit((f) =>
                action.run(async () => {
                  await api("/reports", {
                    method: "POST",
                    body: {
                      contentId: r._id,
                      contentType: "review",
                      reason: formData(f).reason,
                    },
                  });
                  setReport("");
                  setNotice("Review reported.");
                  reload((n) => n + 1);
                }),
              )}
            >
              <Field label="Reason for reporting">
                <input name="reason" required maxLength={1000} />
              </Field>
              <button disabled={action.busy}>Send report</button>
            </form>
          )}
        </article>
      ))}
      {reviews.data?.total === 0 && <p>No guest reviews yet.</p>}
      <ErrorLine text={action.error} />
      {notice && <p role="status">{notice}</p>}
      {reviews.data && (
        <Pager page={page} pages={reviews.data.pages} onPage={setPage} />
      )}
    </section>
  );
}
export function HotelDetail({ id }: { id: string }) {
  const q = useSearchParams(),
    router = useRouter(),
    { user, loading: sessionLoading } = useSession(),
    [roomPage, setRoomPage] = useState(1),
    [selected, pick] = useState<Room[]>([]),
    [restoring, setRestoring] = useState(false),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [info, setInfo] = useState("");
  const dates = {
      checkIn: q.get("checkIn") || "",
      checkOut: q.get("checkOut") || "",
    },
    selectedDates = !!(dates.checkIn && dates.checkOut),
    key = qs(dates),
    requested = q.get("selectedRooms") || "";
  const hotel = useLoad<Hotel>("/hotels/" + id),
    rooms = useLoad<Page<Room>>(
      selectedDates
        ? "/hotels/" + id + "/rooms/available?" + key + "&page=" + roomPage
        : null,
    );
  const action = useAction(),
    traveler = user?.role === "User";
  useEffect(() => {
    let active = true;
    pick([]);
    setCounts({});
    setRoomPage(1);
    setInfo("");
    setRestoring(false);
    if (!requested || !selectedDates) return;
    const ids = new Set(
      requested
        .split(",")
        .filter((s) => /^[a-f\d]{24}$/i.test(s))
        .slice(0, 20),
    );
    if (!ids.size) return;
    setRestoring(true);
    // Resolve the guest's nonpersonal selection at current prices and availability.
    allPages<Room>("/hotels/" + id + "/rooms/available?" + key)
      .then((available) => {
        if (!active) return;
        const restored = available.filter((room) => ids.has(room._id));
        pick(restored);
        if (restored.length !== ids.size)
          setInfo(
            "Some selected rooms are no longer available. Review the remaining rooms.",
          );
      })
      .catch(() => {
        if (active)
          setInfo(
            "Your selection could not be restored. Choose from the available rooms.",
          );
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [id, key, selectedDates, requested]);
  if (!hotel.data)
    return (
      <main className="booking-view">
        <Status state={hotel} />
      </main>
    );
  const h = hotel.data;
  const neededRooms = q.get("rooms") ? Number(q.get("rooms")) : null,
    neededGuests = q.get("guests") ? Number(q.get("guests")) : null;
  return (
    <main className="booking-view stack">
      <Link href={"/stays?" + q.toString()}>← Stays</Link>
      <header>
        <p className="eyebrow">
          {h.city} · {h.country}
        </p>
        <h1>{h.name}</h1>
        <p>
          {h.address} · {h.starClass} stars ·{" "}
          {h.ratingCount
            ? h.averageRating.toFixed(1) + " / 5 (" + h.ratingCount + ")"
            : "Unrated"}
        </p>
      </header>
      {h.imageIds?.length > 0 && (
        <div className="hotel-gallery">
          {h.imageIds.map((img, i) => (
            <img
              key={img}
              crossOrigin="use-credentials"
              src={apiUrl("/media/" + img)}
              alt={h.name + " · photo " + (i + 1)}
              loading="lazy"
            />
          ))}
        </div>
      )}
      <section className="panel stack">
        <p>{h.description}</p>
        <p>{h.amenities.join(" · ")}</p>
        <p>
          Check-in {h.checkInTime} · Check-out {h.checkOutTime} · {h.timezone}
        </p>
        <Tiers tiers={h.cancellationTiers} />
        {traveler && (
          <button
            className="secondary"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                await api("/favourites", {
                  method: "POST",
                  body: { type: "hotel", resourceId: id },
                });
                setInfo("Hotel saved to your favourites.");
              })
            }
          >
            Save to favourites
          </button>
        )}
        {info && <p role="status">{info}</p>}
      </section>
      <form
        className="panel actions"
        onSubmit={submit((form) => {
          if (!validStayDates(form, h.timezone)) return;
          router.push(
            "/hotel/" +
              id +
              "?" +
              qs({
                ...Object.fromEntries(q),
                ...formData(form),
                selectedRooms: "",
              }),
          );
        })}
      >
        <Field label="Check-in">
          <input
            name="checkIn"
            type="date"
            required
            defaultValue={dates.checkIn}
          />
        </Field>
        <Field label="Check-out">
          <input
            name="checkOut"
            type="date"
            required
            defaultValue={dates.checkOut}
          />
        </Field>
        <button className="secondary">Check available rooms</button>
      </form>
      {selectedDates && (
        <section className="panel stack">
          <h2>Available rooms</h2>
          <Status state={rooms} />
          {sessionLoading ? (
            <p role="status">Checking your account…</p>
          ) : !user ? (
            <p>Choose your rooms, then sign in to enter guest details.</p>
          ) : !traveler ? (
            <p className="notice">
              Reservations are available to traveler accounts.
            </p>
          ) : null}
          {rooms.data?.total === 0 && (
            <p>No rooms are available across these dates.</p>
          )}
          {rooms.data?.items.map((r) => {
            const description = (
              <span>
                <strong>
                  {r.type} · Room {r.number}
                </strong>
                <br />
                {r.beds} beds · sleeps {r.occupancy} ·{" "}
                {money(r.price, r.currency)} per night ·{" "}
                {money(r.totalStayPrice, r.currency)} for the stay
              </span>
            );
            return !sessionLoading && (!user || traveler) ? (
              <label className="room-choice" key={r._id}>
                <input
                  type="checkbox"
                  checked={selected.some((x) => x._id === r._id)}
                  disabled={
                    restoring ||
                    (selected.length >= 20 &&
                      !selected.some((x) => x._id === r._id))
                  }
                  onChange={(e) =>
                    pick(
                      e.target.checked
                        ? [...selected, r]
                        : selected.filter((x) => x._id !== r._id),
                    )
                  }
                />
                {description}
              </label>
            ) : (
              <div className="room-choice" key={r._id}>
                {description}
              </div>
            );
          })}
          {rooms.data && (
            <Pager
              page={roomPage}
              pages={rooms.data.pages}
              onPage={setRoomPage}
            />
          )}
          {restoring && <p role="status">Checking your selected rooms…</p>}
          {!sessionLoading && !user && selected.length > 0 && (
            <SignIn
              label="Sign in to continue with selected rooms"
              returnTo={
                "/hotel/" +
                id +
                "?" +
                qs({
                  ...Object.fromEntries(q),
                  selectedRooms: selected.map((room) => room._id).join(","),
                })
              }
            />
          )}
        </section>
      )}
      {traveler && selected.length > 0 && (
        <form
          key={user.id}
          className="panel stack"
          onSubmit={submit((form) =>
            action.run(async () => {
              const d = formData(form);
              if (neededRooms && selected.length !== neededRooms)
                throw new Error(
                  "Select " + neededRooms + " rooms to match your search.",
                );
              const assigned = selected.map((r) => ({
                roomId: r._id,
                guests: Array.from({ length: counts[r._id] || 1 }, (_, i) => ({
                  name: d["name" + r._id + i],
                  age: Number(d["age" + r._id + i]),
                })),
              }));
              const totalGuests = assigned.reduce(
                (n, r) => n + r.guests.length,
                0,
              );
              if (neededGuests && totalGuests !== neededGuests)
                throw new Error(
                  "Assign all " + neededGuests + " guests to rooms.",
                );
              const b = await api<Booking>("/hotel-bookings", {
                method: "POST",
                body: { hotelId: id, ...dates, rooms: assigned },
              });
              router.push(ticketLink(b._id, "hotel"));
            }),
          )}
        >
          <h2>Your rooms &amp; guests</h2>
          {selected.map((r, roomIndex) => (
            <fieldset key={r._id} className="stack">
              <legend>
                {r.type} · Room {r.number}
              </legend>
              <Field label="Guests in this room">
                <input
                  type="number"
                  min="1"
                  max={r.occupancy}
                  value={counts[r._id] || 1}
                  onChange={(e) =>
                    setCounts({
                      ...counts,
                      [r._id]: Math.max(
                        1,
                        Math.min(r.occupancy, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </Field>
              {Array.from({ length: counts[r._id] || 1 }, (_, i) => (
                <div className="grid" key={i}>
                  <Field label={"Guest " + (i + 1) + " name"}>
                    <input
                      required
                      name={"name" + r._id + i}
                      data-api-field={
                        "rooms." + roomIndex + ".guests." + i + ".name"
                      }
                      maxLength={100}
                    />
                  </Field>
                  <Field label={"Guest " + (i + 1) + " age"}>
                    <input
                      required
                      name={"age" + r._id + i}
                      data-api-field={
                        "rooms." + roomIndex + ".guests." + i + ".age"
                      }
                      type="number"
                      min={0}
                      max={120}
                    />
                  </Field>
                </div>
              ))}
            </fieldset>
          ))}
          <strong>
            Total{" "}
            {money(
              selected.reduce((s, r) => s + r.totalStayPrice, 0),
              selected[0].currency,
            )}
          </strong>
          <button className="button" disabled={action.busy}>
            Hold rooms for 10 minutes →
          </button>
        </form>
      )}
      <ErrorLine text={action.error} />
      <HotelReviews id={id} />
    </main>
  );
}
export function StayReview({ booking }: { booking: Booking }) {
  const [existing, setExisting] = useState<Review | null | undefined>(),
    [err, setErr] = useState(""),
    [refresh, reload] = useState(0),
    action = useAction();
  const hotelId = booking.snapshot.hotelId;
  useEffect(() => {
    let live = true;
    setExisting(undefined);
    setErr("");
    allPages<Review>("/hotels/" + hotelId + "/reviews")
      .then((list) => {
        if (live)
          setExisting(list.find((x) => x.bookingId === booking._id) || null);
      })
      .catch((e) => {
        if (live) setErr(e.message);
      });
    return () => {
      live = false;
    };
  }, [hotelId, booking._id, refresh]);
  if (existing === undefined)
    return (
      <section className="panel">
        <p>{err || "Checking your review…"}</p>
        {err && <button onClick={() => reload((n) => n + 1)}>Retry</button>}
      </section>
    );
  return (
    <section className="panel stack">
      <h2>{existing ? "Your review" : "Review your stay"}</h2>
      <form
        key={existing?._id || "new"}
        className="stack"
        onSubmit={submit((f) =>
          action.run(async () => {
            const d = formData(f);
            await api(
              existing
                ? "/reviews/" + existing._id
                : "/hotel-bookings/" + booking._id + "/review",
              {
                method: existing ? "PATCH" : "POST",
                body: { rating: Number(d.rating), body: d.body },
              },
            );
            reload((n) => n + 1);
          }),
        )}
      >
        <Field label="Rating">
          <select name="rating" defaultValue={existing?.rating || ""} required>
            <option value="">Choose rating</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Field>
        <Field label="Review">
          <textarea
            name="body"
            defaultValue={existing?.body || ""}
            maxLength={1000}
          />
        </Field>
        <div className="actions">
          <button disabled={action.busy} className="button">
            {existing ? "Save changes" : "Post review"}
          </button>
          {existing && (
            <button
              disabled={action.busy}
              type="button"
              className="secondary"
              onClick={() => {
                if (window.confirm("Delete your hotel review?"))
                  action.run(async () => {
                    await api("/reviews/" + existing._id, {
                      method: "DELETE",
                      body: { confirm: true },
                    });
                    reload((n) => n + 1);
                  });
              }}
            >
              Delete review
            </button>
          )}
        </div>
      </form>
      <ErrorLine text={action.error} />
    </section>
  );
}
