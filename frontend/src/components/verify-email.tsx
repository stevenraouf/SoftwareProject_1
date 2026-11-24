"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

export function VerifyEmail() {
  const token = useSearchParams().get("token") || "";
  const { user, reload } = useSession();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const valid = /^[a-f0-9]{64}$/.test(token);

  async function verify() {
    if (!valid || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/auth/verify-email?token=" + encodeURIComponent(token));
      setVerified(true);
      window.history.replaceState(window.history.state, "", "/verify-email");
      if (user) await reload();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Verification failed. Please try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="wrap content narrow">
      <h1>{verified ? "Email verified" : "Verify your email"}</h1>
      <section className="panel stack">
        {verified ? (
          <p role="status">Your travel account is verified.</p>
        ) : valid ? (
          <>
            <p>
              Confirm that you own the email address used to create your travel
              account.
            </p>
            <button type="button" disabled={busy} onClick={verify}>
              {busy ? "Verifying?" : "Verify email"}
            </button>
          </>
        ) : (
          <p role="alert">
            Open the complete verification link from your email.
          </p>
        )}
        {error && (
          <p role="alert" className="notice invalid">
            {error}
          </p>
        )}
        <Link href={user ? "/account" : "/login"}>
          {user ? "My account" : "Sign in"}
        </Link>
      </section>
    </main>
  );
}
