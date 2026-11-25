"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { localReturn } from "@/lib/api";

const navigation = [
  ["/flights", "Flights"],
  ["/stays", "Stays"],
  ["/planner", "Trip planner"],
  ["/journal", "Journal"],
];
function Signature({ replay }: { replay: number }) {
  return (
    <Link key={replay} className="signature" href="/" aria-label="AERIS home">
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
    </Link>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    router = useRouter(),
    { user } = useSession(),
    prior = useRef(path);
  const [menu, setMenu] = useState(false),
    [cloud, setCloud] = useState(false),
    [replay, setReplay] = useState(0),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const initial = () => {
      const value = localStorage.getItem("aeris-motion");
      setReduced(value === "reduced" || (!value && mq.matches));
    };
    initial();
    mq.addEventListener("change", initial);
    return () => mq.removeEventListener("change", initial);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "standard";
    if (reduced) setCloud(false);
  }, [reduced]);
  useEffect(() => {
    setMenu(false);
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
    if (prior.current === path) return;
    prior.current = path;
    if (reduced || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    setCloud(true);
    const timer = setTimeout(
      () => setCloud(false),
      path.startsWith("/explore/") ? 825 : 480,
    );
    return () => clearTimeout(timer);
  }, [path, reduced, user?.forcePasswordChange, router]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCloud(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
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
          <Signature replay={replay} />
          <nav className="main-nav" aria-label="Main menu">
            {navigation.map(([url, text]) => (
              <Link
                href={url}
                key={url}
                aria-current={path === url ? "page" : undefined}
              >
                {text}
              </Link>
            ))}
          </nav>
          <div className="mast-right">
            <Link href={right}>{label}</Link>
            <Link className="desktop-nav" href="/help">
              Help
            </Link>
            <Link className="button desktop-nav" href={signIn}>
              {user ? "Account" : "Sign in"}
            </Link>
            <button
              className="menu-button"
              aria-label="Menu"
              aria-expanded={menu}
              aria-controls="phone-nav"
              onClick={() => setMenu(!menu)}
            >
              ☰
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
              <Link key={p} href={p} onClick={() => setMenu(false)}>
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
            {[
              ["/flights", "⌕", "Flight search"],
              ["/stays", "⌂", "Find a stay"],
              ["/planner", "▤", "Trip planner"],
              ["/journal", "▧", "Travel journal"],
            ].map(([p, icon, t]) => (
              <Link href={p} key={p}>
                <span aria-hidden>{icon}</span> {t}
              </Link>
            ))}
          </nav>
          <div className="footer-meta">
            <Link href="/credits">Photography credits</Link>
            <Link href="/terms">Terms &amp; privacy</Link>
            <button
              className="quiet"
              onClick={() => {
                localStorage.setItem(
                  "aeris-motion",
                  reduced ? "standard" : "reduced",
                );
                setReduced(!reduced);
              }}
            >
              {reduced ? "Use standard motion" : "Reduce motion"}
            </button>
            <button
              className="quiet"
              onClick={() => {
                setReplay((r) => r + 1);
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
            >
              Replay logo
            </button>
          </div>
        </div>
      </footer>
      {cloud && (
        <button
          className="cloud-passage"
          aria-label="Skip cloud transition"
          onClick={() => setCloud(false)}
          style={{
            animationDuration: path.startsWith("/explore/") ? "825ms" : "480ms",
          }}
        />
      )}
    </>
  );
}
