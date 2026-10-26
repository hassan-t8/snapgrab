/**
 * "My tools": favourites and recently used tools, kept only in this browser (localStorage).
 * No account needed; a change anywhere notifies listeners through the "sg:mytools" event.
 */
const FAV = "sg-fav-tools";
const RECENT = "sg-recent-tools";
const EVENT = "sg:mytools";
const MAX_RECENT = 8;

function read(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}

function write(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export const getFavourites = () => read(FAV);
export const getRecent = () => read(RECENT);

export function toggleFavourite(slug: string) {
  const list = read(FAV);
  const next = list.includes(slug) ? list.filter((s) => s !== slug) : [slug, ...list];
  write(FAV, next);
  return next.includes(slug);
}

export function recordRecent(slug: string) {
  write(RECENT, [slug, ...read(RECENT).filter((s) => s !== slug)].slice(0, MAX_RECENT));
}

export function onMyToolsChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
