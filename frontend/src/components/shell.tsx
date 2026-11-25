"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { localReturn } from "@/lib/api";
import { CabinPassage } from "./cabin-passage";
import { CabinHeadings } from "./cabin-headings";

const navigation = [
  ["/flights", "Flights"],
  ["/stays", "Stays"],
  ["/planner", "Trip planner"],
  ["/journal", "Journal"],
];
const footerLinks = [
  ["/flights", "search", "Flight search", "Flight search"],
  ["/stays", "bed", "Find a stay", "Stays"],
  ["/planner", "map", "Trip planner", "Trip planner"],
  ["/journal", "book", "Travel journal", "Journal"],
] as const;

const cabinIcons = {
  menu: "M2 5h16M2 10h16M2 15h16",
  search: "M14 8.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 1 1 11 0ZM12.5 13l5.5 5",
  bed: "M2 16V5m0 8h16v4M5 10V7h4v3Zm5 0V7h7l1 3Z",
  map: "M2 4l5-2 6 3 5-2v13l-5 2-6-3-5 2ZM7 2v13m6-10v13",
  book: "M2 3h5q3 0 3 3 0-3 3-3h5v13h-5q-3 0-3 2 0-2-3-2H2ZM10 6v12",
  motion: "M2 5h8m-8 5h5m-5 5h8m2-10 6 5-6 5Z",
};
function CabinIcon({ name }: { name: keyof typeof cabinIcons }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={cabinIcons[name]} />
    </svg>
  );
}

function SignatureInk() {
  return (
    <>
      <svg
        aria-hidden="true"
        width="25"
        height="31"
        viewBox="0 0 25 31"
        fill="none"
      >
        <rect
          x="3.5"
          y="2.1"
          width="18"
          height="26.8"
          rx="9"
          stroke="currentColor"
          strokeWidth="2.3"
        />
        <path
          d="M5 9q7-6 15 0M5 19q6 4 15-3"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <circle cx="15" cy="12" r="2" fill="currentColor" />
      </svg>
      <span>AERIS</span>
    </>
  );
}

function Signature() {
  return (
    <>
      <SignatureInk />
      <span className="signature-reflection" aria-hidden="true">
        <SignatureInk />
      </span>
    </>
  );
}

function LogoReplay({
  reduced,
  close,
}: {
  reduced: boolean;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [still, setStill] = useState(reduced);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="logo-replay"
      aria-labelledby="brand-motion-title"
      onCancel={close}
      onClick={(event) => {
        if (event.target === dialog.current) {
          const bounds = dialog.current.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            close();
        }
      }}
    >
      <header>
        <h2 id="brand-motion-title">Brand motion</h2>
        <button className="quiet" onClick={close} autoFocus>
          Close
        </button>
      </header>
      <div className="logo-stage">
        <div key={run} className="signature" data-still={still || reduced}>
          <Signature />
        </div>
      </div>
      <div className="logo-controls">
        <button
          className="quiet"
          onClick={() => {
            setStill(false);
            setRun((n) => n + 1);
          }}
        >
          Replay motion
        </button>
        <button
          className="quiet"
          aria-pressed={still || reduced}
          onClick={() => setStill(true)}
        >
          View still
        </button>
      </div>
    </dialog>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    router = useRouter(),
    { user } = useSession();
  const replayTrigger = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const shellHref = (url: string) =>
    url === "/flights" && path === "/" ? "/flights?choose=destination" : url;
  function closeReplay() {
    setReplay(false);
    requestAnimationFrame(() =>
      replayTrigger.current?.focus({ preventScroll: true }),
    );
  }
  const [menu, setMenu] = useState(false),
    [replay, setReplay] = useState(false),
    [hydrated, setHydrated] = useState(false),
    [systemReduced, setSystemReduced] = useState(false),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const initial = () => {
      let saved = false;
      try {
        saved = localStorage.getItem("aeris-motion") === "reduced";
      } catch {}
      const value = saved || mq.matches;
      document.documentElement.dataset.motion = value ? "reduced" : "standard";
      setReduced(value);
      setSystemReduced(mq.matches);
    };
    initial();
    setHydrated(true);
    mq.addEventListener("change", initial);
    window.addEventListener("storage", initial);
    return () => {
      mq.removeEventListener("change", initial);
      window.removeEventListener("storage", initial);
    };
  }, []);
  useEffect(() => {
    setMenu(false);
    setReplay(false);
    if (
      user?.forcePasswordChange &&
      !["/password", "/account"].includes(path)
    ) {
      const next =
        path === "/login"
          ? localReturn(new URLSearchParams(window.location.search).get("next"))
          : null;
      router.replace(
        next ? "/password?next=" + encodeURIComponent(next) : "/password",
      );
    }
  }, [path, user?.forcePasswordChange, router]);
  useEffect(() => {
    if (!menu) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        menuTrigger.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [menu]);
  const signIn = user ? "/account" : "/login",
    right = user?.role && user.role !== "User" ? "/workspace" : "/trips",
    label = right === "/workspace" ? "Workspace" : "My trips";
  return (
    <>
      <a className="skip" href="#page-content">
        Skip to content
      </a>
      <header className="mast">
        <div className="wrap mast-inner">
          <Link className="signature" href="/" aria-label="AERIS home">
            <Signature />
          </Link>
          <nav className="main-nav" aria-label="Main menu">
            {navigation.map(([url, text]) => (
              <Link
                href={shellHref(url)}
                key={url}
                className={url === "/journal" ? "tablet-hidden" : undefined}
                aria-current={path === url ? "page" : undefined}
              >
                {text}
              </Link>
            ))}
          </nav>
          <div className="mast-right">
            <Link href={right} className="tablet-hidden">
              {label}
            </Link>
            <Link className="desktop-nav" href="/help">
              Help
            </Link>
            <Link className="button desktop-nav" href={signIn}>
              {user ? "Account" : "Sign in"}
            </Link>
            <button
              className="menu-button"
              ref={menuTrigger}
              disabled={!hydrated}
              aria-label="Menu"
              aria-expanded={menu}
              aria-controls="phone-nav"
              onClick={() => setMenu(!menu)}
            >
              <CabinIcon name="menu" />
            </button>
          </div>
        </div>
        {menu && (
          <nav id="phone-nav" className="phone-nav" aria-label="Phone menu">
            {[
              ...navigation,
              ["/help", "Help"],
              [signIn, user ? "Account" : "Sign in"],
            ].map(([p, t]) => (
              <Link key={p} href={shellHref(p)} onClick={() => setMenu(false)}>
                {t}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <div id="page-content" tabIndex={-1}>
        {children}
      </div>
      <footer>
        <div className="wrap">
          <nav className="footer-links">
            {footerLinks.map(([p, icon, t, compact]) => (
              <Link href={shellHref(p)} key={p}>
                <CabinIcon name={icon} />
                {t === compact ? (
                  t
                ) : (
                  <>
                    <span className="footer-wide-label">{t}</span>
                    <span className="footer-compact-label">{compact}</span>
                  </>
                )}
              </Link>
            ))}
          </nav>
          <div className="footer-meta">
            <button
              className="quiet motion-choice"
              disabled={!hydrated || systemReduced}
              title={
                systemReduced
                  ? "Reduced motion is enabled on your device"
                  : undefined
              }
              onClick={() => {
                const mode = reduced ? "standard" : "reduced";
                try {
                  localStorage.setItem("aeris-motion", mode);
                } catch {}
                document.documentElement.dataset.motion = mode;
                setReduced(!reduced);
              }}
            >
              <CabinIcon name="motion" />
              {systemReduced
                ? "Reduced motion"
                : reduced
                  ? "Use standard motion"
                  : "Reduce motion"}
            </button>
            <button
              className="quiet replay-choice"
              ref={replayTrigger}
              disabled={!hydrated}
              onClick={() => setReplay(true)}
            >
              Replay logo
            </button>
            <div className="footer-disclosures">
              <Link href="/credits">Photography credits</Link>
              <Link href="/terms">Terms &amp; privacy</Link>
            </div>
            <div className="footer-service-links">
              <Link href="/workspace">Workspaces</Link>
              <Link href="/help">Help</Link>
              <Link href="/trips">My trips</Link>
            </div>
          </div>
        </div>
      </footer>
      {replay && <LogoReplay reduced={reduced} close={closeReplay} />}
      <CabinHeadings path={path} reduced={reduced} />
      <CabinPassage reduced={reduced} />
    </>
  );
}
