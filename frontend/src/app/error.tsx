"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="wrap content">
      <h1>We couldn’t open this page</h1>
      <div className="actions">
        <button onClick={reset}>Try again</button>
        <Link href="/">Back to the window</Link>
      </div>
    </main>
  );
}
