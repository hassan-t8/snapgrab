/* SnapGrab service worker — makes the site installable and lets visited tools open offline.
 *
 * - Pages: network first (always fresh when online), cached copy when offline, else /offline.
 * - Build assets (/_next/static, fonts, icons): cache first — their URLs change on every deploy.
 * - Never touches /api/, /admin or other origins, and never caches non-GET requests.
 */
const VERSION = "v1";
const PAGES = `sg-pages-${VERSION}`;
const ASSETS = `sg-assets-${VERSION}`;
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll([OFFLINE, "/tools"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, ASSETS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isAsset = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:woff2?|ttf|svg|png|jpg|webp)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin") || url.pathname.startsWith("/go/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE)) || Response.error()),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          }),
      ),
    );
  }
});
