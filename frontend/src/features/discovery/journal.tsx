"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import {
  Action,
  authorLink,
  choices,
  displayDate,
  Editor,
  LoadState,
  Media,
  Pager,
  query,
  Report,
  signInLink,
  useResource,
  type Author,
  type Field,
  type Fields,
  type Page,
} from "./shared";

interface StoryRow {
  id?: string;
  _id?: string;
  title: string;
  author?: string;
  date?: string;
  createdAt?: string;
  status?: string;
  excerpt?: string;
  body?: string;
  tags: string[];
  likeCount?: number;
  commentCount?: number;
}
interface Comment {
  _id: string;
  userId: string;
  author: Author;
  body: string;
  createdAt: string;
  hidden: boolean;
}
interface Story extends Omit<StoryRow, "author"> {
  _id: string;
  userId: string;
  author: Author;
  body: string;
  imageIds: string[];
  comments: Page<Comment>;
  hidden: boolean;
  likedByMe: boolean;
  attachedItinerary?: { id: string; title: string } | null;
}
interface PlanOption {
  id: string;
  title: string;
}

function StoryForm({
  story,
  onDone,
}: {
  story?: Story;
  onDone: (id: string) => void;
}) {
  const fields: Field[] = [
    {
      name: "title",
      label: "Title",
      required: true,
      maxLength: 200,
      initial: story?.title,
    },
    {
      name: "status",
      label: "Visibility",
      required: true,
      type: "select",
      options: choices(["Draft", "Published"]),
      initial: story?.status ?? "Draft",
    },
    {
      name: "body",
      label: "Your story",
      required: true,
      type: "textarea",
      maxLength: 100000,
      initial: story?.body,
    },
    {
      name: "tags",
      label: "Tags",
      initial: story?.tags.join(", "),
      hint: "Separate up to five tags with commas. Each tag can have up to 30 characters.",
    },
  ];
  return (
    <Editor
      fields={fields}
      action={story ? "Save changes" : "Save story"}
      onSave={async (values) => {
        const tags = values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (tags.length > 5 || tags.some((t) => t.length > 30))
          throw new Error(
            "Tags must be 30 characters or shorter, with up to five per story.",
          );
        const record = await api<Story>(
          story ? "/posts/" + story._id : "/posts",
          {
            method: story ? "PATCH" : "POST",
            body: {
              title: values.title,
              body: values.body,
              status: values.status,
              tags,
            },
          },
        );
        onDone(record._id);
      }}
    />
  );
}

function StoryCards({ rows }: { rows: StoryRow[] }) {
  if (!rows.length)
    return (
      <p className="panel">
        No stories found. Try another keyword or tag, or start a new story in
        your notebook.
      </p>
    );
  return (
    <div className="discovery-cards">
      {rows.map((row) => (
        <article className="panel" key={row.id || row._id}>
          <p className="discovery-meta">
            {[row.author, row.status, displayDate(row.date || row.createdAt)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h3>
            <Link href={"/post/" + (row.id || row._id)}>{row.title}</Link>
          </h3>
          <p>{row.excerpt ?? row.body?.slice(0, 200)}</p>
          <TagList tags={row.tags} />
          {row.likeCount != null && (
            <small>
              {row.likeCount} likes · {row.commentCount ?? 0} comments
            </small>
          )}
        </article>
      ))}
    </div>
  );
}

function TagList({ tags }: { tags?: string[] }) {
  return tags?.length ? (
    <div className="discovery-tags">
      {tags.map((tag) => (
        <Link href={"/journal?tag=" + encodeURIComponent(tag)} key={tag}>
          #{tag}
        </Link>
      ))}
    </div>
  ) : null;
}

export function Journal() {
  const { user } = useSession(),
    router = useRouter(),
    search = useSearchParams();
  const traveler = user?.role === "User",
    tab = search.get("section") ?? "public";
  const page = Math.max(1, Number(search.get("page")) || 1),
    tag = search.get("tag") || "",
    keyword = search.get("q") || "";
  function go(data: Fields) {
    router.push("/journal?" + query(data));
  }
  const path =
    tab === "mine"
      ? traveler
        ? "/posts/mine?page=" + page
        : null
      : tab === "write"
        ? null
        : tag && !keyword
          ? "/tags/" + encodeURIComponent(tag) + "/posts?page=" + page
          : "/posts?" + query({ page: String(page), tag, q: keyword });
  const list = useResource<Page<StoryRow>>(path);
  const member = (target: string) => (traveler ? target : signInLink(target));
  return (
    <>
      <header className="discovery-hero">
        <div>
          <span className="discovery-kicker">AERIS JOURNAL</span>
          <h1>Travel journal</h1>
          <p>Notes and discoveries from the community.</p>
        </div>
        <img
          src="/art/parisStreets.jpg"
          alt="The Seine and the Pont Alexandre III at dusk"
        />
      </header>
      <nav className="discovery-tabs" aria-label="Journal views">
        <Link
          aria-current={tab === "public" ? "page" : undefined}
          href="/journal"
        >
          Published stories
        </Link>
        {(!user || traveler) && (
          <>
            <Link
              aria-current={tab === "mine" ? "page" : undefined}
              href={member("/journal?section=mine")}
            >
              My notebook
            </Link>
            <Link
              aria-current={tab === "write" ? "page" : undefined}
              href={member("/journal?section=write")}
            >
              Write a story
            </Link>
          </>
        )}
      </nav>
      {tab === "write" ? (
        <section className="panel">
          <h2>Write a story</h2>
          {traveler ? (
            <StoryForm onDone={(id) => router.push("/post/" + id)} />
          ) : (
            <Link href={signInLink("/journal?section=write")}>
              Sign in to write a story
            </Link>
          )}
        </section>
      ) : (
        <section>
          {tab === "mine" ? (
            <h2>My notebook</h2>
          ) : (
            <div className="panel">
              <h2>Find a story</h2>
              <Editor
                key={keyword + ":" + tag}
                action="Search stories"
                fields={[
                  {
                    name: "q",
                    label: "Keyword or author",
                    initial: keyword,
                    maxLength: 100,
                  },
                  { name: "tag", label: "Tag", initial: tag, maxLength: 30 },
                ]}
                onSave={async (v) => go(v)}
              />
            </div>
          )}
          {tab === "mine" && !traveler ? (
            <Link href={signInLink("/journal?section=mine")}>
              Sign in to view your notebook
            </Link>
          ) : list.data ? (
            <>
              <StoryCards rows={list.data.items} />
              <Pager
                page={page}
                pages={list.data.pages}
                go={(n) =>
                  go({ page: String(n), section: tab, tag, q: keyword })
                }
              />
            </>
          ) : (
            <LoadState error={list.error} retry={list.reload} />
          )}
        </section>
      )}
    </>
  );
}

function AttachPlan({ story, reload }: { story: Story; reload: () => void }) {
  const [keyword, setKeyword] = useState(""),
    [page, setPage] = useState(1);
  const plans = useResource<Page<PlanOption>>(
    "/itineraries/public/search?" + query({ q: keyword, page: String(page) }),
  );
  return (
    <details className="discovery-fold">
      <summary>Attach a public itinerary</summary>
      <Editor
        fields={[
          { name: "q", label: "Search public itineraries", maxLength: 100 },
        ]}
        action="Find itineraries"
        onSave={async (v) => {
          setPage(1);
          setKeyword(v.q);
        }}
      />
      {plans.data ? (
        <>
          <ul className="discovery-list">
            {plans.data.items.map((plan) => (
              <li key={plan.id}>
                <span>{plan.title}</span>
                <Action
                  success="Itinerary attached."
                  perform={async () => {
                    await api("/posts/" + story._id + "/itinerary", {
                      method: "PATCH",
                      body: { itineraryId: plan.id },
                    });
                    reload();
                  }}
                >
                  Attach
                </Action>
              </li>
            ))}
          </ul>
          {!plans.data.total && <p>No matching public itinerary.</p>}
          <Pager page={page} pages={plans.data.pages} go={setPage} />
        </>
      ) : (
        <LoadState error={plans.error} retry={plans.reload} />
      )}
      {story.attachedItinerary && (
        <Action
          confirmText="Remove the itinerary from this story?"
          perform={async () => {
            await api("/posts/" + story._id + "/itinerary", {
              method: "PATCH",
              body: {},
            });
            reload();
          }}
        >
          Detach itinerary
        </Action>
      )}
    </details>
  );
}

export function StoryPage({ id }: { id: string }) {
  const { user, loading } = useSession(),
    router = useRouter();
  const [page, setPage] = useState(1);
  const result = useResource<Story>(
      loading ? null : "/posts/" + id + "?page=" + page,
    ),
    story = result.data;
  if (!story) return <LoadState retry={result.reload} error={result.error} />;
  const traveler = user?.role === "User",
    own = traveler && user?.id === story.userId,
    published = story.status === "Published";
  return (
    <>
      <Link href="/journal">← Travel journal</Link>
      <article className="panel discovery-reading">
        <p className="discovery-meta">
          {story.status} · {displayDate(story.createdAt)}
        </p>
        <h1>{story.title}</h1>
        <p>By {authorLink(story.author)}</p>
        <TagList tags={story.tags} />
        <div className="discovery-prose">{story.body}</div>
        <Media
          ids={story.imageIds ?? []}
          base={"/posts/" + id + "/images"}
          editable={!!own}
          reload={result.reload}
          label={story.title}
        />
        {story.attachedItinerary && (
          <p>
            Attached itinerary ·{" "}
            <Link href={"/itinerary/" + story.attachedItinerary.id}>
              {story.attachedItinerary.title}
            </Link>
          </p>
        )}
        {own && (
          <>
            <details className="discovery-fold">
              <summary>Edit story</summary>
              <StoryForm
                key={story.title + story.status}
                story={story}
                onDone={result.reload}
              />
            </details>
            <AttachPlan story={story} reload={result.reload} />
            <Action
              confirmText="Permanently delete this story and its conversation?"
              perform={async () => {
                await api("/posts/" + id, {
                  method: "DELETE",
                  body: { confirm: true },
                });
                router.replace("/journal?section=mine");
              }}
            >
              Delete story
            </Action>
          </>
        )}
      </article>
      <section className="panel">
        <h2>The conversation</h2>
        <p>
          {story.likeCount || 0} likes · {story.comments.total} comments
        </p>
        {published && traveler && (
          <div className="actions">
            <Action
              perform={async () => {
                await api("/posts/" + id + "/like", {
                  method: story.likedByMe ? "DELETE" : "POST",
                });
                result.reload();
              }}
            >
              {story.likedByMe ? "Remove my like" : "Like story"}
            </Action>
          </div>
        )}
        {published && !user && (
          <p>
            <Link href={signInLink("/post/" + id + "#conversation")}>
              Sign in to like, comment or report
            </Link>
          </p>
        )}
        {published && traveler && (
          <section id="conversation">
            <Editor
              fields={[
                {
                  name: "body",
                  label: "Your comment",
                  type: "textarea",
                  required: true,
                  maxLength: 500,
                },
              ]}
              action="Post comment"
              done="Comment posted."
              onSave={async (v) => {
                await api("/posts/" + id + "/comments", {
                  method: "POST",
                  body: { body: v.body },
                });
                setPage(Math.ceil((story.comments.total + 1) / 10));
                result.reload();
              }}
            />
          </section>
        )}
        {!story.comments.total && <p>There are no comments yet.</p>}
        {story.comments.items.map((c) => (
          <article key={c._id} className="discovery-comment">
            <small>
              {authorLink(c.author)} · {displayDate(c.createdAt)}
              {c.hidden ? " · Hidden" : ""}
            </small>
            <p>{c.body}</p>
            {traveler &&
              (user?.id === c.userId ? (
                <>
                  <details className="discovery-fold">
                    <summary>Edit comment</summary>
                    <Editor
                      action="Save comment"
                      fields={[
                        {
                          name: "body",
                          label: "Comment",
                          required: true,
                          type: "textarea",
                          maxLength: 500,
                          initial: c.body,
                        },
                      ]}
                      onSave={async (v) => {
                        await api("/comments/" + c._id, {
                          method: "PATCH",
                          body: { body: v.body },
                        });
                        result.reload();
                      }}
                    />
                  </details>
                  <Action
                    confirmText="Delete your comment?"
                    perform={async () => {
                      await api("/comments/" + c._id, {
                        method: "DELETE",
                        body: { confirm: true },
                      });
                      setPage(
                        Math.min(
                          page,
                          Math.max(
                            1,
                            Math.ceil((story.comments.total - 1) / 10),
                          ),
                        ),
                      );
                      result.reload();
                    }}
                  >
                    Delete comment
                  </Action>
                </>
              ) : (
                <Report type="comment" id={c._id} />
              ))}
          </article>
        ))}
        <Pager page={page} pages={story.comments.pages} go={setPage} />
        {published && traveler && !own && <Report type="post" id={id} />}
      </section>
    </>
  );
}

export function AuthorPage({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const result = useResource<{
    author: Author;
    posts: Page<StoryRow>;
    itineraries: Page<{ _id: string; title: string; startDate: string }>;
  }>("/authors/" + id + "?page=" + page);
  if (!result.data)
    return <LoadState error={result.error} retry={result.reload} />;
  const { author, posts, itineraries } = result.data;
  return (
    <>
      <Link href="/journal">← Travel journal</Link>
      <header className="panel">
        <p className="discovery-kicker">Author’s notebook</p>
        <h1>{author.name}</h1>
        <p>Joined {displayDate(author.joinDate)}</p>
      </header>
      <section>
        <h2>Published stories</h2>
        <StoryCards rows={posts.items} />
      </section>
      <section className="panel">
        <h2>Public itineraries</h2>
        {itineraries.items.map((p) => (
          <p key={p._id}>
            <Link href={"/itinerary/" + p._id}>{p.title}</Link> ·{" "}
            {displayDate(p.startDate)}
          </p>
        ))}
        {!itineraries.items.length && (
          <p>No public itineraries on this page.</p>
        )}
      </section>
      <Pager
        page={page}
        pages={Math.max(posts.pages, itineraries.pages)}
        go={setPage}
      />
    </>
  );
}
