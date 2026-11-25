export type ListView = "journal" | "planner";
export interface InitialList<T> {
  path: string;
  data?: T;
  error?: string;
}
export type SearchValues = Record<string, string | string[] | undefined>;

export function searchFromValues(values: SearchValues) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) search.set(key, first);
  }
  return search;
}

export const query = (data: Record<string, string>) =>
  new URLSearchParams(
    Object.entries(data).filter(([, value]) => value !== ""),
  ).toString();

export function discoveryList(
  view: ListView,
  search: Pick<URLSearchParams, "get">,
) {
  const section = search.get("section");
  const editor = view === "journal" ? "write" : "create";
  const tab = section === "mine" || section === editor ? section : "public";
  const requested = Number(search.get("page"));
  const page =
    Number.isSafeInteger(requested) && requested > 0 && requested <= 1_000_000
      ? requested
      : 1;
  const fields =
    view === "journal"
      ? ["q", "tag"]
      : ["q", "city", "country", "minDays", "maxDays"];
  const filters = Object.fromEntries(
    fields.map((field) => [field, search.get(field) || ""]),
  );
  const endpoint = view === "journal" ? "/posts" : "/itineraries/public/search";
  const publicPath =
    tab === "public"
      ? endpoint + "?" + query({ ...filters, page: String(page) })
      : null;
  return { tab, page, filters, publicPath };
}
