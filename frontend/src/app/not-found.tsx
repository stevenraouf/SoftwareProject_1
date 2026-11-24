import Link from "next/link";
export default function NotFound() {
  return (
    <main className="wrap content">
      <h1>Page unavailable</h1>
      <Link className="button" href="/">
        Back to the window
      </Link>
    </main>
  );
}
