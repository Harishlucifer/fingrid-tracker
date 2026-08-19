"use client";

/**
 * The last resort: an error thrown by the ROOT layout itself.
 *
 * `error.tsx` wraps pages and nested layouts, but not the layout above it in the
 * same segment — so if the root layout throws, that boundary never mounts and
 * Next falls back to its own bare screen. This file replaces the whole document
 * when that happens, which is why it declares its own `<html>` and `<body>`.
 *
 * Two consequences follow from replacing the document, both deliberate here:
 *
 *  * **Global styles do not load.** Tailwind classes and the design tokens in
 *    `globals.css` are unavailable, so everything below is inline. Reaching for
 *    a class here would produce unstyled text, not a styled page.
 *  * **The theme does not reach it.** `next-themes` sets `data-theme` on the
 *    root element the app renders, and this is not that element. So the colours
 *    follow the operating system through `prefers-color-scheme` instead — the
 *    one signal still available — rather than pretending to match the app.
 *
 * There is no `metadata` export either; error boundaries are Client Components.
 * React's `<title>` is the supported way to name the tab, per the Next 16 docs.
 */

const COLORS = `
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f7f8fa;
    color: #0a1b33;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .muted { color: #5b6780; }
  .chip { background: #e8ebf1; }
  a, button.link { color: #1e6fe6; }
  @media (prefers-color-scheme: dark) {
    body { background: #041124; color: #e8ebf1; }
    .muted { color: #93a0b8; }
    .chip { background: #0a1b33; }
    a, button.link { color: #5b9bff; }
  }
`;

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong · Inforvio PM</title>
        <style>{COLORS}</style>

        <main style={{ maxWidth: "28rem", padding: "2rem", textAlign: "center" }}>
          <p
            className="muted"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.875rem", margin: 0 }}
          >
            Error
          </p>
          <h1
            style={{
              margin: "0.5rem 0 0",
              fontSize: "1.5rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Inforvio PM could not start
          </h1>
          <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", lineHeight: 1.6 }}>
            This one is at the very top of the app rather than on a single page,
            so reloading is worth trying before anything else. If it persists,
            the reference below identifies this exact failure in the server log.
          </p>

          {error.digest && (
            <p
              className="chip muted"
              style={{
                display: "inline-block",
                margin: "1rem 0 0",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.375rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
              }}
            >
              {error.digest}
            </p>
          )}

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button
              type="button"
              className="link"
              onClick={retry}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                font: "inherit",
                fontSize: "0.875rem",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Try again
            </button>
            <a href="/dashboard" style={{ fontSize: "0.875rem" }}>
              Back to dashboard
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
