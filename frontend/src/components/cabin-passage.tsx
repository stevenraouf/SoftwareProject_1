"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// The destination is committed while the cloud banks cover the old page.
// Their reveal waits for Next to commit, including on an uncached route.
const timings = {
  page: { cover: 270, reveal: 210 },
  explore: { cover: 425, reveal: 400 },
};

type Passage = {
  kind: keyof typeof timings;
  phase: "enter" | "exit";
};

function destinationLink(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return null;
  const link =
    event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>("a[href]")
      : null;
  if (
    !link ||
    (link.target && link.target !== "_self") ||
    link.hasAttribute("download")
  )
    return null;
  const url = new URL(link.href, window.location.href);
  if (
    url.origin !== location.origin ||
    url.pathname === location.pathname ||
    /\/(?:api|_next|art|uploads)\//.test(url.pathname) ||
    /\.[^/]+$/.test(url.pathname)
  )
    return null;
  return { link, url };
}

export function CabinPassage({ reduced }: { reduced: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const previousPath = useRef(path);
  const [passage, setPassage] = useState<Passage | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const replaying = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeKind = useRef<Passage["kind"] | null>(null);
  const requestedPath = useRef<string | null>(null);
  const skippedPath = useRef<string | null>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const keyboardStart = useRef(false);

  function finish() {
    clearTimeout(timer.current);
    const navigate = pending.current;
    pending.current = null;
    skippedPath.current = requestedPath.current;
    requestedPath.current = null;
    activeKind.current = null;
    setPassage(null);
    navigate?.();
  }

  useEffect(() => {
    if (reduced) {
      finish();
      return;
    }
    function start(event: MouseEvent) {
      if (
        replaying.current ||
        document.documentElement.dataset.motion === "reduced" ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      const target = destinationLink(event);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      keyboardStart.current = event.detail === 0;
      clearTimeout(timer.current);
      const kind =
        location.pathname === "/" &&
        /^\/explore\/[^/]+\/?$/.test(target.url.pathname)
          ? "explore"
          : "page";
      activeKind.current = kind;
      requestedPath.current = target.url.pathname;
      pending.current = () => {
        // Let the original link run its Next handler once so Back, hash, scroll
        // and any component click handlers keep their normal behavior.
        replaying.current = true;
        try {
          if (target.link.isConnected) target.link.click();
          else
            router.push(
              target.url.pathname + target.url.search + target.url.hash,
            );
        } finally {
          replaying.current = false;
        }
      };
      setPassage({ kind, phase: "enter" });
      timer.current = setTimeout(() => {
        const navigate = pending.current;
        pending.current = null;
        // A cancelled or failed navigation must not leave a blocking veil.
        timer.current = setTimeout(finish, 5000);
        navigate?.();
      }, timings[kind].cover);
    }
    function onKey(event: KeyboardEvent) {
      if (!activeKind.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
      } else if (event.key === "Tab") {
        event.preventDefault();
        skipButton.current?.focus({ preventScroll: true });
      }
    }
    function historyChange() {
      pending.current = null;
      finish();
    }
    document.addEventListener("click", start, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", historyChange);
    return () => {
      document.removeEventListener("click", start, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", historyChange);
      clearTimeout(timer.current);
    };
  }, [reduced, router]);

  useEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    if (reduced || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const skip = skippedPath.current === path;
    skippedPath.current = null;
    requestedPath.current = null;
    if (skip) return;
    // Programmatic redirects and form submissions can reveal the new page,
    // but must never delay a mutation or replay a submitted form.
    const kind = activeKind.current ?? "page";
    activeKind.current = kind;
    clearTimeout(timer.current);
    pending.current = null;
    setPassage({ kind, phase: "exit" });
    timer.current = setTimeout(finish, timings[kind].reveal);
  }, [path, reduced]);

  useEffect(() => {
    if (passage?.phase === "enter" && keyboardStart.current) {
      skipButton.current?.focus({ preventScroll: true });
    }
  }, [passage]);

  if (!passage) return null;
  return (
    <div
      className="cabin-passage"
      data-kind={passage.kind}
      data-phase={passage.phase}
    >
      <div className="cloud-veil" aria-hidden="true" />
      <div className="cloud-bank cloud-upper" aria-hidden="true" />
      <div className="cloud-bank cloud-lower" aria-hidden="true" />
      <button
        className="passage-surface"
        aria-label="Skip cloud transition"
        tabIndex={-1}
        onClick={finish}
      />
      <button
        ref={skipButton}
        type="button"
        className="passage-skip"
        onClick={finish}
      >
        {passage.kind === "explore" ? "Skip to destination" : "Skip animation"}
      </button>
    </div>
  );
}
