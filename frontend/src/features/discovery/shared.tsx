"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api, apiUrl } from "@/lib/api";
import { getFieldErrors, useFormErrors } from "@/lib/form-errors";

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}
export interface Author {
  id: string | null;
  name: string;
  joinDate?: string;
}
export interface Option {
  value: string;
  label: string;
}
export interface Field {
  name: string;
  label: string;
  type?:
    "text" | "textarea" | "date" | "time" | "number" | "select" | "multiple";
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: string;
  options?: Option[];
  initial?: string | number | string[];
  hint?: string;
  placeholder?: string;
}
export type Fields = Record<string, string>;
export type FormAction = (fields: Fields, raw: FormData) => Promise<void>;
export const choices = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
export const failure = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "The request could not be completed. Please try again.";
export const displayDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(value))
    : "";
export const cash = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
export { query } from "@/lib/discovery-list";
export const authorLink = (author?: Author) =>
  author?.id ? (
    <Link href={"/author/" + author.id}>{author.name}</Link>
  ) : (
    author?.name
  );
export const signInLink = (next: string) =>
  "/login?next=" + encodeURIComponent(next);

export function useResource<T>(path: string | null, initial?: T, ready = true) {
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<
    | {
        path: string;
        data?: T;
        error?: string;
      }
    | undefined
  >(() =>
    path && initial !== undefined ? { path, data: initial } : undefined,
  );
  useEffect(() => {
    let active = true;
    if (path && ready) {
      api<T>(path)
        .then((data) => {
          if (active) setSnapshot({ path, data });
        })
        .catch((e) => {
          if (active) setSnapshot({ path, error: failure(e) });
        });
    }
    return () => {
      active = false;
    };
  }, [path, version, ready]);
  return {
    data: snapshot?.path === path ? snapshot?.data : undefined,
    error: snapshot?.path === path ? snapshot?.error : undefined,
    reload: () => setVersion((value) => value + 1),
  };
}

export async function allPages<T>(url: string): Promise<T[]> {
  const separator = url.includes("?") ? "&" : "?";
  const first = await api<Page<T>>(url + separator + "page=1");
  const records = [...first.items];
  for (let page = 2; page <= first.pages; page++) {
    const next = await api<Page<T>>(url + separator + "page=" + page);
    records.push(...next.items);
  }
  return records;
}

export function LoadState({
  error,
  retry,
}: {
  error?: string;
  retry: () => void;
}) {
  return error ? (
    <div role="alert" className="panel">
      <p>{error}</p>
      <button type="button" className="secondary" onClick={retry}>
        Try again
      </button>
    </div>
  ) : (
    <p role="status">Loading…</p>
  );
}

export function Pager({
  page,
  pages,
  go,
  href,
}: {
  page: number;
  pages: number;
  go: (page: number) => void;
  href?: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="discovery-pager" aria-label="Result pages">
      {href && page > 1 ? (
        <Link href={href(page - 1)} rel="prev">
          Previous
        </Link>
      ) : (
        <button type="button" disabled={page <= 1} onClick={() => go(page - 1)}>
          Previous
        </button>
      )}
      <span>
        Page {page} of {pages}
      </span>
      {href && page < pages ? (
        <Link href={href(page + 1)} rel="next">
          Next
        </Link>
      ) : (
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => go(page + 1)}
        >
          Next
        </button>
      )}
    </nav>
  );
}

export function Editor({
  fields,
  onSave,
  action,
  done,
  children,
}: {
  fields: Field[];
  onSave: FormAction;
  action: string;
  done?: string;
  children?: ReactNode;
}) {
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { errors, setErrors, formEvents } = useFormErrors();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const raw = new FormData(form);
    const values = Object.fromEntries(
      [...raw.entries()].map(([k, v]) => [k, String(v).trim()]),
    );
    setBusy(true);
    setMessage("");
    setErrors({});
    try {
      await onSave(values, raw);
      if (done) {
        setMessage(done);
        form.reset();
      }
    } catch (e) {
      setErrors(getFieldErrors(e));
      setMessage(failure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="discovery-form" onSubmit={submit} {...formEvents}>
      {fields.map((f) => {
        const id = uid + f.name,
          invalid = !!errors[f.name];
        const attrs = {
          name: f.name,
          id,
          required: f.required,
          "aria-invalid": invalid || undefined,
          "aria-describedby": invalid || f.hint ? id + "-help" : undefined,
        };
        return (
          <div
            className={
              "discovery-field " +
              (f.type === "textarea" || f.type === "multiple" ? "wide" : "")
            }
            key={f.name}
          >
            <label htmlFor={id}>{f.label}</label>
            {f.type === "textarea" ? (
              <textarea
                {...attrs}
                defaultValue={f.initial}
                maxLength={f.maxLength}
                rows={f.name === "body" ? 5 : 3}
                placeholder={f.placeholder}
              />
            ) : f.type === "select" || f.type === "multiple" ? (
              <select
                key={f.options?.length}
                {...attrs}
                multiple={f.type === "multiple"}
                defaultValue={f.initial ?? (f.type === "multiple" ? [] : "")}
              >
                {f.type !== "multiple" && (
                  <option value="">
                    {f.required ? "Choose…" : "Any / none"}
                  </option>
                )}
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...attrs}
                type={f.type ?? "text"}
                defaultValue={f.initial}
                min={f.min}
                max={f.max}
                step={f.step}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
              />
            )}
            {(invalid || f.hint) && (
              <small id={id + "-help"}>{errors[f.name] || f.hint}</small>
            )}
          </div>
        );
      })}
      {children}
      <div className="wide">
        <button disabled={busy} type="submit">
          {busy ? "Working…" : action}
        </button>
      </div>
      {message && (
        <p className="wide notice" role="status">
          {message}
        </p>
      )}
    </form>
  );
}

export function Action({
  children,
  perform,
  confirmText,
  success,
  secondary = true,
}: {
  children: ReactNode;
  perform: () => Promise<void>;
  confirmText?: string;
  success?: string;
  secondary?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirming, setConfirming] = useState(false);
  async function execute() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await perform();
      if (success) setMessage(success);
      setConfirming(false);
    } catch (e) {
      setMessage(failure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="discovery-action">
      {confirming ? (
        <span role="group" aria-label={confirmText}>
          <strong>{confirmText}</strong>
          <span className="actions">
            <button type="button" disabled={busy} onClick={execute}>
              {busy ? "Working…" : "Confirm"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Keep it
            </button>
          </span>
        </span>
      ) : (
        <button
          type="button"
          className={secondary ? "secondary" : undefined}
          disabled={busy}
          onClick={confirmText ? () => setConfirming(true) : execute}
        >
          {busy ? "Working…" : children}
        </button>
      )}
      {message && <small role="status">{message}</small>}
    </span>
  );
}

export function Report({
  type,
  id,
}: {
  type: "post" | "comment" | "itinerary";
  id: string;
}) {
  return (
    <details className="discovery-fold">
      <summary>Report {type === "post" ? "story" : type}</summary>
      <Editor
        fields={[
          {
            name: "reason",
            label: "Reason for reporting",
            type: "textarea",
            required: true,
            maxLength: 1000,
          },
        ]}
        action="Send report"
        done="Report sent for review."
        onSave={async (values) => {
          await api("/reports", {
            method: "POST",
            body: { contentType: type, contentId: id, reason: values.reason },
          });
        }}
      />
    </details>
  );
}

export function Media({
  ids,
  base,
  editable,
  reload,
  label,
}: {
  ids: string[];
  base: string;
  editable: boolean;
  reload: () => void;
  label: string;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const uid = useId();
  return (
    <div className="discovery-media">
      {ids?.length > 0 && (
        <div className="discovery-gallery">
          {ids.map((id, i) => (
            <figure key={id}>
              <img
                crossOrigin="use-credentials"
                loading="lazy"
                alt={label + " · photo " + (i + 1)}
                src={apiUrl("/media/" + id)}
              />
              {editable && (
                <figcaption>
                  <Action
                    confirmText="Remove this photograph?"
                    perform={async () => {
                      await api(base + "/" + id, { method: "DELETE" });
                      reload();
                    }}
                  >
                    Remove photo {i + 1}
                  </Action>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
      {editable && ids.length < 5 && (
        <div className="discovery-upload">
          <label htmlFor={uid}>Add a photograph</label>
          <small>JPEG or PNG · up to 5 MB each · {ids.length}/5</small>
          <input
            id={uid}
            type="file"
            accept="image/jpeg,image/png"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (
                file.size > 5 * 1024 * 1024 ||
                !["image/png", "image/jpeg"].includes(file.type)
              ) {
                setMessage("Choose a JPEG or PNG of 5 MB or less.");
                return;
              }
              const payload = new FormData();
              payload.set("file", file);
              setBusy(true);
              setMessage("");
              try {
                await api(base, { method: "POST", body: payload });
                reload();
                setMessage("Photograph added.");
              } catch (err) {
                setMessage(failure(err));
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      )}
      {(busy || message) && (
        <small role="status">{busy ? "Uploading photograph…" : message}</small>
      )}
    </div>
  );
}
