"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, localReturn } from "@/lib/api";
import { useSession, type User } from "@/lib/session";

const titles: Record<string, string> = {
  login: "Welcome back",
  register: "Create your account",
  forgot: "Recover your account",
  reset: "Set a new password",
  password: "Change your password",
  account: "Your profile",
  notifications: "Notifications",
  favourites: "Saved places",
};
export function Account({ view }: { view: string }) {
  const session = useSession(),
    router = useRouter(),
    query = useSearchParams();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({});
  const [currencies, setCurrencies] = useState<string[]>([]),
    [page, setPage] = useState(1),
    [rows, setRows] = useState<any>(),
    [version, setVersion] = useState(0);
  const user = session.user;
  const next = localReturn(query.get("next")),
    after = next ? "?next=" + encodeURIComponent(next) : "";
  useEffect(() => {
    let active = true;
    if (view === "account")
      api<string[]>("/currencies")
        .then((list) => {
          if (active) setCurrencies(list);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    if ((view === "notifications" || view === "favourites") && user) {
      setRows(undefined);
      api("/" + view + "?page=" + page)
        .then((result) => {
          if (active) setRows(result);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }
    return () => {
      active = false;
    };
  }, [view, page, version, user?.id]);
  const protectedView = [
    "account",
    "password",
    "notifications",
    "favourites",
  ].includes(view);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setFields({});
    const form = new FormData(event.currentTarget);
    const formValues = Object.fromEntries(form.entries());
    try {
      switch (view) {
        case "login": {
          const { user: account } = await api<{ user: User }>("/auth/login", {
            method: "POST",
            body: formValues,
          });
          await session.reload();
          router.replace(
            account.forcePasswordChange
              ? "/password"
              : next || (account.role === "User" ? "/trips" : "/workspace"),
          );
          break;
        }
        case "register":
          await api("/auth/register", {
            method: "POST",
            body: { ...formValues, consent: form.has("consent") },
          });
          router.replace(
            "/login?registered=1" +
              (next ? "&next=" + encodeURIComponent(next) : ""),
          );
          break;
        case "forgot":
          setMessage(
            (
              await api("/auth/forgot-password", {
                method: "POST",
                body: formValues,
              })
            ).message,
          );
          break;
        case "reset":
          await api("/auth/reset-password", {
            method: "POST",
            body: { ...formValues, token: query.get("token") },
          });
          router.replace("/login?updated=1");
          break;
        case "password":
          await api("/auth/change-password", {
            method: "PATCH",
            body: formValues,
          });
          await session.reload();
          router.replace("/login?updated=1");
          break;
        case "account":
          await api("/users/me", { method: "PATCH", body: formValues });
          await session.reload();
          setMessage("Profile saved.");
          break;
      }
    } catch (e) {
      const problem = e as ApiError;
      setError(problem.message);
      const detail = Object.fromEntries(
        (problem.fields || []).map((f) => [f.field, f.messages.join(" ")]),
      );
      if (view === "register" && problem.status === 409)
        detail.email = "This email address is already registered.";
      setFields(detail);
    } finally {
      setBusy(false);
    }
  }
  async function action(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, { method, body });
      if (path === "/users/me" || path === "/auth/logout") {
        await session.reload();
        router.replace("/");
        return;
      }
      setVersion((n) => n + 1);
      setMessage("Updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function input(
    name: string,
    label: string,
    type = "text",
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) {
    return (
      <label className="field">
        {label}
        <input
          required
          name={name}
          type={type}
          aria-invalid={!!fields[name]}
          {...props}
        />
        {fields[name] && <small className="invalid">{fields[name]}</small>}
      </label>
    );
  }
  const strong = {
    pattern: "(?=.*[A-Za-z])(?=.*[0-9]).{8,128}",
    minLength: 8,
    maxLength: 128,
    autoComplete: "new-password",
    title: "At least eight characters, one letter and one number.",
  };
  if (protectedView && !user)
    return (
      <main className="wrap content">
        <h1>{titles[view]}</h1>
        {session.loading ? (
          <p>Checking your session…</p>
        ) : (
          <Link
            className="button"
            href={"/login?next=" + encodeURIComponent("/" + view)}
          >
            Sign in to continue
          </Link>
        )}
      </main>
    );
  const isList = view === "notifications" || view === "favourites";
  return (
    <main className="wrap content narrow">
      <Link href="/" className="back">
        ← Home
      </Link>
      <h1>{titles[view]}</h1>
      {query.get("registered") === "1" && (
        <p className="notice">
          Account created. Sign in to continue and check your inbox for any
          verification email.
        </p>
      )}
      {query.get("updated") === "1" && (
        <p className="notice">
          Password updated. Sign in with your new password.
        </p>
      )}
      {user?.forcePasswordChange && (
        <p className="notice">Set a new password to unlock your workspace.</p>
      )}
      {error && (
        <p className="notice invalid" role="alert">
          {error}{" "}
          {isList && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setError("");
                setVersion((n) => n + 1);
              }}
            >
              Try again
            </button>
          )}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {isList ? (
        <div className="panel stack" aria-busy={!rows && !error}>
          {rows ? (
            <>
              {view === "notifications" && <h2>{rows.unreadCount} unread</h2>}
              {!rows.items.length && (
                <p>
                  {view === "notifications"
                    ? "You’re all caught up."
                    : "Save a hotel or public itinerary to find it here."}
                </p>
              )}
              {rows.items.map((r: any) => (
                <article className="list-item" key={r._id}>
                  {view === "notifications" ? (
                    <>
                      <div>
                        <strong>{r.message}</strong>
                        <small>{new Date(r.createdAt).toLocaleString()}</small>
                      </div>
                      {!r.readAt && (
                        <button
                          disabled={busy}
                          className="secondary"
                          onClick={() =>
                            action("/notifications/" + r._id + "/read", "PATCH")
                          }
                        >
                          Mark as read
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>
                          {r.type === "hotel"
                            ? "Saved hotel"
                            : "Saved itinerary"}
                        </strong>
                        {r.unavailable ? (
                          <p>Currently unavailable</p>
                        ) : (
                          <p>
                            <Link href={"/" + r.type + "/" + r.resourceId}>
                              Open {r.type} →
                            </Link>
                          </p>
                        )}
                      </div>
                      <button
                        disabled={busy}
                        className="secondary"
                        onClick={() => {
                          if (window.confirm("Remove this saved item?"))
                            void action("/favourites/" + r._id, "DELETE");
                        }}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </article>
              ))}
              {rows.pages > 1 && (
                <div className="actions">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {rows.pages}
                  </span>
                  <button
                    disabled={page >= rows.pages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            !error && <p>Loading…</p>
          )}
        </div>
      ) : (
        <form className="panel stack" onSubmit={submit}>
          {view === "account" && user && (
            <p>
              {user.email} · {user.role}
              <br />
              <small>
                Joined {new Date(user.registrationDate).toLocaleDateString()}
              </small>
            </p>
          )}
          {["account", "register"].includes(view) &&
            input("name", "Name", "text", {
              defaultValue: view === "account" ? user?.name : "",
              autoComplete: "name",
              maxLength: 100,
            })}
          {["login", "register", "forgot"].includes(view) &&
            input("email", "Email address", "email", {
              autoComplete: "email",
              maxLength: 254,
            })}
          {view === "login" &&
            input("password", "Password", "password", {
              autoComplete: "current-password",
            })}
          {view === "register" &&
            input("password", "Password", "password", strong)}
          {view === "password" &&
            input("currentPassword", "Current password", "password", {
              autoComplete: "current-password",
            })}
          {["password", "reset"].includes(view) &&
            input("newPassword", "New password", "password", strong)}
          {["register", "password", "reset"].includes(view) && (
            <small>
              Use 8–128 characters, including a letter and a number.
            </small>
          )}
          {view === "register" && (
            <label className="check">
              <input type="checkbox" name="consent" required />I agree to the{" "}
              <Link href="/terms" target="_blank">
                terms and privacy notice
              </Link>
              .
            </label>
          )}
          {view === "account" && (
            <>
              {input("phone", "Phone number", "tel", {
                required: false,
                defaultValue: user?.phone,
                autoComplete: "tel",
                maxLength: 25,
              })}
              <label>
                Preferred currency
                <select
                  name="preferredCurrency"
                  defaultValue={user?.preferredCurrency || "USD"}
                >
                  {Array.from(
                    new Set([user?.preferredCurrency || "USD", ...currencies]),
                  ).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button disabled={busy}>
            {busy
              ? "Saving…"
              : {
                  login: "Sign in",
                  register: "Create account",
                  forgot: "Send reset link",
                  account: "Save profile",
                  password: "Change password",
                  reset: "Set new password",
                }[view]}
          </button>
          {view === "login" && (
            <div className="actions">
              <Link href={"/register" + after}>Create an account</Link>
              <Link href="/forgot">Forgot password?</Link>
            </div>
          )}
          {["register", "forgot", "reset"].includes(view) && (
            <Link href={"/login" + after}>Back to sign in</Link>
          )}
        </form>
      )}
      {view === "account" && (
        <section className="panel stack">
          <h2>Account settings</h2>
          <div className="actions">
            <Link href="/password">Change password</Link>
            <Link href="/notifications">Notifications</Link>
            {user?.role === "User" && (
              <Link href="/favourites">Saved places</Link>
            )}
          </div>
          <div className="actions">
            <button
              disabled={busy}
              className="secondary"
              onClick={() => action("/auth/logout", "POST")}
            >
              Sign out
            </button>
            {user?.role === "User" && (
              <button
                disabled={busy}
                className="danger"
                onClick={() => {
                  if (
                    window.confirm(
                      "Deactivate your account and hide its public content? This will sign you out.",
                    )
                  )
                    void action("/users/me", "DELETE", { confirm: true });
                }}
              >
                Deactivate account
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
