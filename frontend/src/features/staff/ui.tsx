"use client";

import {
  useCallback,
  useEffect,
  useState,
  useId,
  type ReactNode,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export type Values = Record<string, string>;
export type Page<T> = {
  items: T[];
  page: number;
  pages: number;
  total: number;
};
export type IdName = { _id: string; name: string };
export type Tier = { threshold: number; refundPercent: number };
export type Provider = IdName & {
  type: "airline" | "hotel";
  active: boolean;
  code?: string;
  city?: string;
  country?: string;
  address?: string;
  description?: string;
  amenities?: string[];
  starClass?: number;
  timezone?: string;
  logoId?: string;
  imageIds?: string[];
  checkInTime?: string;
  checkOutTime?: string;
  cancellationTiers?: Tier[];
  maxExtraBags?: number;
  extraBagPrice?: number;
};
export type Option = string | { value: string; label: string };
export type Field = {
  name: string;
  label: string;
  type?: string;
  options?: Option[];
  optional?: boolean;
  min?: number;
  max?: number;
  step?: string;
  pattern?: string;
  initial?: string | number;
  placeholder?: string;
  maxLength?: number;
};
export function message(e: unknown) {
  if (e instanceof ApiError && e.fields?.length)
    return e.fields
      .map((field) => field.field + " · " + field.messages.join(". "))
      .join(" / ");
  return e instanceof Error
    ? e.message
    : "This request could not be completed.";
}
export function query(values: Values) {
  const q = new URLSearchParams(
    Object.entries(values).filter(([, v]) => v !== ""),
  );
  return q.toString();
}
export function useResource<T>(url: string | null, revision = 0) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>(
    { key: "" },
  );
  const key = JSON.stringify([url, revision]);
  useEffect(() => {
    let current = true;
    if (url)
      api<T>(url).then(
        (data) => {
          if (current) setState({ key, data });
        },
        (e) => {
          if (current) setState({ key, error: message(e) });
        },
      );
    return () => {
      current = false;
    };
  }, [url, key]);
  const fresh = state.key === key;
  return {
    data: fresh ? state.data : undefined,
    error: fresh ? state.error : undefined,
    loading: !!url && (!fresh || (!state.error && state.data === undefined)),
  };
}
export function useWorkspaceSection(items: string[]) {
  const params = useSearchParams();
  const router = useRouter();
  const slug = (label: string) => label.toLowerCase().replaceAll(" ", "-");
  const current =
    items.find((item) => slug(item) === params.get("section")) || items[0];
  function choose(section: string) {
    const next = new URLSearchParams(params.toString());
    next.set("section", slug(section));
    next.delete("flight");
    router.push("/workspace?" + next.toString(), { scroll: false });
  }
  return [current, choose] as const;
}
export function useRevision() {
  const [revision, change] = useState(0);
  return [revision, useCallback(() => change((n) => n + 1), [])] as const;
}
export async function referenceRows<T>(url: string): Promise<T[]> {
  const first = await api<Page<T>>(url);
  const rows = [...first.items];
  for (let p = 2; p <= first.pages; p++) {
    const result = await api<Page<T>>(url + "?page=" + p);
    rows.push(...result.items);
  }
  return rows;
}
export function useReferences<T>(url: string, revision = 0) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setError("");
    referenceRows<T>(url).then(
      (r) => {
        if (current) setRows(r);
      },
      (e) => {
        if (current) setError(message(e));
      },
    );
    return () => {
      current = false;
    };
  }, [url, revision]);
  return { rows, error };
}
export function Problem({ children }: { children?: string }) {
  return children ? (
    <p className="notice" role="alert">
      {children}
    </p>
  ) : null;
}
export function Form({
  fields,
  submit,
  onSubmit,
  children,
  confirmation,
  success,
  reset = false,
}: {
  fields: Field[];
  submit: string;
  onSubmit: (values: Values, form: FormData) => Promise<unknown> | void;
  children?: ReactNode;
  confirmation?: string;
  success?: string;
  reset?: boolean;
}) {
  const uid = useId();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  function fieldAttrs(name: string) {
    return {
      "aria-invalid": fieldErrors[name] ? true : undefined,
      "aria-describedby": fieldErrors[name] ? uid + "-" + name : undefined,
    };
  }
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const element = event.currentTarget,
      form = new FormData(element);
    if (confirmation && !window.confirm(confirmation)) return;
    setPending(true);
    setFieldErrors({});
    setError("");
    setDone(false);
    try {
      const values = Object.fromEntries(
        [...form.entries()].filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
      await onSubmit(values, form);
      if (reset) element.reset();
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.fields?.length) {
        setFieldErrors(
          Object.fromEntries(
            e.fields.map((f) => [f.field, f.messages.join(". ")]),
          ),
        );
      }
      setError(message(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="staffForm"
      onSubmit={handle}
      onInvalidCapture={(event) => {
        const input = event.target;
        if (
          (input instanceof HTMLInputElement ||
            input instanceof HTMLSelectElement ||
            input instanceof HTMLTextAreaElement) &&
          input.name
        )
          setFieldErrors((previous) => ({
            ...previous,
            [input.name]: input.validationMessage,
          }));
      }}
      onChangeCapture={(event) => {
        const input = event.target;
        if (
          (input instanceof HTMLInputElement ||
            input instanceof HTMLSelectElement ||
            input instanceof HTMLTextAreaElement) &&
          fieldErrors[input.name]
        ) {
          setFieldErrors((previous) => {
            const updated = { ...previous };
            delete updated[input.name];
            return updated;
          });
        }
      }}
    >
      <div className="staffFields">
        {fields.map((f) => (
          <label className="field" key={f.name}>
            <span>{f.label}</span>
            {f.options ? (
              <select
                key={String(f.initial ?? "") + "-" + f.options.length}
                {...fieldAttrs(f.name)}
                name={f.name}
                required={!f.optional}
                defaultValue={f.initial ?? ""}
              >
                {(f.optional || f.initial === undefined) && (
                  <option value="">{f.optional ? "All" : "Choose…"}</option>
                )}
                {f.options.map((o) => (
                  <option
                    key={typeof o === "string" ? o : o.value}
                    value={typeof o === "string" ? o : o.value}
                  >
                    {typeof o === "string" ? o : o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                {...fieldAttrs(f.name)}
                name={f.name}
                rows={3}
                defaultValue={f.initial}
                required={!f.optional}
                maxLength={f.maxLength}
              />
            ) : (
              <input
                type={f.type || "text"}
                {...fieldAttrs(f.name)}
                name={f.name}
                defaultValue={f.initial}
                required={!f.optional}
                min={f.min}
                max={f.max}
                step={f.step}
                pattern={f.pattern}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
                autoComplete={
                  f.type === "password" ? "new-password" : undefined
                }
              />
            )}
            {fieldErrors[f.name] && (
              <small className="invalid" id={uid + "-" + f.name}>
                {fieldErrors[f.name]}
              </small>
            )}
          </label>
        ))}
      </div>
      {children}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Working…" : submit}
      </button>
      <Problem>{error}</Problem>
      {done && success && <p role="status">{success}</p>}
    </form>
  );
}
export function Action({
  label,
  act,
  confirmation,
  success,
}: {
  label: string;
  act: () => Promise<unknown>;
  confirmation?: string;
  success?: string;
}) {
  return (
    <Form
      fields={[]}
      submit={label}
      confirmation={confirmation}
      onSubmit={act}
      success={success}
    />
  );
}
export function PageList<T>({
  url,
  revision = 0,
  draw,
  empty,
  resetKey = "",
}: {
  url: string;
  revision?: number;
  draw: (item: T, i: number) => ReactNode;
  empty: string;
  resetKey?: string;
}) {
  return (
    <PagedRows
      key={url + resetKey}
      url={url}
      revision={revision}
      draw={draw}
      empty={empty}
    />
  );
}
function PagedRows<T>({
  url,
  revision,
  draw,
  empty,
}: {
  url: string;
  revision: number;
  draw: (item: T, i: number) => ReactNode;
  empty: string;
}) {
  const [page, setPage] = useState(1);
  const r = useResource<Page<T>>(
    url + (url.includes("?") ? "&" : "?") + "page=" + page,
    revision,
  );
  const pages = r.data?.pages;
  useEffect(() => {
    if (pages !== undefined && page > Math.max(1, pages))
      setPage(Math.max(1, pages));
  }, [pages, page]);
  return (
    <div className="stack">
      {r.loading && <p role="status">Loading records…</p>}
      <Problem>{r.error}</Problem>
      {r.data && (
        <>
          {r.data.items.length ? (
            r.data.items.map(draw)
          ) : (
            <p className="muted">{empty}</p>
          )}
          {!!pages && (
            <div className="staffPager">
              <button
                className="secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {pages} · {r.data.total} records
              </span>
              <button
                className="secondary"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="panel stack staffSection">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function Fold({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="staffFold">
      <summary>{title}</summary>
      <div className="stack">{children}</div>
    </details>
  );
}
export function Row({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="staffRow">
      <h3>{title}</h3>
      {meta && <p className="muted">{meta}</p>}
      {children}
    </article>
  );
}
export function Tabs({
  items,
  current,
  choose,
}: {
  items: string[];
  current: string;
  choose: (tab: string) => void;
}) {
  return (
    <nav className="staffTabs" aria-label="Workspace sections">
      {items.map((item) => (
        <button
          type="button"
          key={item}
          aria-current={item === current ? "page" : undefined}
          onClick={() => choose(item)}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
export function isoDate(daysFromNow = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}
export function amount(value: number, currency = "USD") {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    value,
  );
}
