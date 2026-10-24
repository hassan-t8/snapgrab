/**
 * Client-side click / interaction tracking for the admin "Clicks & events" report.
 *
 *   trackEvent("download", "passport-photo-maker")
 *   trackEvent("copy", "whatsapp-link-generator")
 *
 * Fire-and-forget: analytics must never break or slow down what the user is doing.
 * Names are short verbs (download, copy, share, open, calculate, generate, …);
 * the label is usually the tool slug or the button it came from. On a tool page it
 * defaults to that tool's slug.
 */
function defaultLabel() {
  const m = window.location.pathname.match(/^\/(?:tools|download)\/([^/]+)/);
  return m?.[1];
}

export function trackEvent(name: string, label?: string) {
  if (typeof window === "undefined") return;
  try {
    fetch("/api/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ name: name.slice(0, 40), label: (label ?? defaultLabel())?.slice(0, 80), path: window.location.pathname }),
    }).catch(() => {});
  } catch {
    // never let tracking throw into UI code
  }
}
