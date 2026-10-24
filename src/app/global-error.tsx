"use client";

/** Last-resort screen if the root layout itself fails; it must render its own <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#07060f", color: "#f4f3ff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, marginTop: 12 }}>Please refresh the page. If it keeps happening, try again in a few minutes.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 20, padding: "12px 24px", borderRadius: 14, border: 0, background: "#7048f0", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
