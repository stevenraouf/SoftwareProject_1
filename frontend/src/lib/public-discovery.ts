import "server-only";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import { get } from "node:https";
import { Readable } from "node:stream";
import type { Metadata } from "next";
import type { PublicContent, PublicListing } from "@/features/discovery";
import { discoveryList, type ListView } from "./discovery-list";

async function publicResponse(path: string) {
  const base =
    process.env.AERIS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://localhost:3443/api";
  const url = new URL(base.replace(/\/$/, "") + path);
  const signal = AbortSignal.timeout(6000);
  if (
    url.protocol === "https:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname)
  ) {
    // Local development uses the project's self-signed API certificate.
    const ca = await readFile(
      process.env.AERIS_API_CA_PATH || "../.certs/localhost.pem",
    );
    return new Promise<Response>((resolve, reject) => {
      get(url, { ca, family: 4, signal }, (res) => {
        resolve(
          new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, {
            status: res.statusCode,
          }),
        );
      }).on("error", reject);
    });
  }
  return fetch(url, {
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal,
  });
}

// Only the anonymous read endpoints feed public HTML and metadata. React's
// cache shares a read within this render and never across different requests.
export const readPublicContent = cache(
  async (view: string, id: string): Promise<PublicContent | undefined> => {
    if (!/^[a-f\d]{24}$/i.test(id)) return;
    const endpoint =
      view === "post"
        ? "posts"
        : view === "author"
          ? "authors"
          : view === "itinerary"
            ? "itineraries/public"
            : null;
    if (!endpoint) return;
    const response = await publicResponse("/" + endpoint + "/" + id);
    if ([401, 403, 404].includes(response.status)) {
      await response.body?.cancel();
      return;
    }
    if (!response.ok) throw new Error("Public travel content is unavailable.");
    const data = await response.json();
    if (view === "post" && data.status === "Published" && !data.hidden)
      return { view, data };
    if (view === "itinerary" && data.visibility === "Public" && !data.hidden)
      return { view, data };
    if (view === "author") return { view, data };
  },
);

export async function readPublicListing(
  view: ListView,
  search: URLSearchParams,
): Promise<PublicListing | undefined> {
  const { publicPath } = discoveryList(view, search);
  if (!publicPath) return;
  try {
    const response = await publicResponse(publicPath);
    if (response.ok)
      return { view, path: publicPath, data: await response.json() };
    await response.body?.cancel();
    if (response.status === 400)
      return {
        view,
        path: publicPath,
        error: "Check your search filters and try again.",
      };
  } catch {
    // The client still offers a retry when the public API is temporarily offline.
  }
  return {
    view,
    path: publicPath,
    error: "Public search is temporarily unavailable. Please try again.",
  };
}

export function publicMetadata(content?: PublicContent): Metadata {
  if (!content) return { robots: { index: false, follow: false } };
  const title =
    content.view === "author" ? content.data.author.name : content.data.title;
  let description: string;
  if (content.view === "post") {
    description = content.data.body.trim().replace(/\s+/g, " ").slice(0, 160);
  } else if (content.view === "author") {
    description =
      "Published travel stories and public itineraries by " + title + ".";
  } else {
    const plan = content.data;
    description =
      plan.title +
      " by " +
      plan.author.name +
      " · " +
      plan.countries.join(", ") +
      " · " +
      plan.startDate;
  }
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: content.view === "post" ? "article" : "website",
    },
  };
}
