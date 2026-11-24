const base = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://localhost:3443/api"
).replace(/\/$/, "");

export function apiUrl(path: string) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    throw new Error("Invalid API path");
  const runtime =
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLMetaElement>('meta[name="aeris-api"]')
          ?.content;
  return (runtime || base).replace(/\/$/, "") + path;
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal };
type FieldError = { field: string; messages: string[] };
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: FieldError[] = [],
  ) {
    super(message);
  }
}
function csrf() {
  return typeof document === "undefined"
    ? ""
    : document.cookie
        .split("; ")
        .find((x) => x.startsWith("csrf_token="))
        ?.slice(11);
}
function request(path: string, { method = "GET", body, signal }: Options) {
  const headers = new Headers();
  const token = csrf();
  if (method !== "GET" && token)
    headers.set("X-CSRF-Token", decodeURIComponent(token));
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart)
    headers.set("Content-Type", "application/json");
  return fetch(apiUrl(path), {
    method,
    headers,
    credentials: "include",
    cache: "no-store",
    signal,
    body: multipart
      ? body
      : body === undefined
        ? undefined
        : JSON.stringify(body),
  });
}
let refreshing: Promise<boolean> | undefined;
export async function api<T = any>(
  path: string,
  options: Options = {},
): Promise<T> {
  let response: Response;
  try {
    response = await request(path, options);
    if (
      response.status === 401 &&
      csrf() &&
      !/^\/auth\/(login|register|refresh|logout|forgot-password|reset-password)/.test(
        path,
      )
    ) {
      refreshing ??= request("/auth/refresh", { method: "POST" })
        .then((r) => r.ok)
        .finally(() => {
          refreshing = undefined;
        });
      if (await refreshing) response = await request(path, options);
      else if (typeof window !== "undefined")
        window.dispatchEvent(new Event("aeris:expired"));
    }
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      0,
      "Couldn’t reach the booking service. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      Array.isArray(problem.message)
        ? problem.message.join(". ")
        : problem.message || "The request could not be completed.",
      problem.errors,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.headers.get("content-type")?.includes("json")
    ? response.json()
    : ((await response.text()) as T);
}

export function localReturn(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return null;
  return value;
}
