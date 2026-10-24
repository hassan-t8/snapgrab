import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

/**
 * Keys and settings for outside services (RapidAPI, SMTP, AdSense …), editable from
 * Admin → Integrations. A value saved there wins over the same variable in .env, so the
 * site can be reconfigured without a redeploy; clearing it falls back to .env again.
 *
 * Secret values are encrypted at rest (AES-256-GCM, key derived from AUTH_SECRET) and are
 * never sent back to the browser — the admin UI only ever sees "saved, ends in …1234".
 */

export type FieldDef = {
  label: string;
  /** encrypted in the database and masked in the UI */
  secret?: boolean;
  placeholder?: string;
  hint?: string;
  /** used when neither the admin panel nor .env sets it */
  fallback?: string;
  kind?: "text" | "number" | "boolean" | "email";
};

export type GroupId = "rapidapi" | "smtp" | "adsense" | "google" | "rates";

export type GroupDef = {
  title: string;
  description: string;
  docs: string;
  /** fields keyed by their .env variable name */
  fields: Record<string, FieldDef>;
  /** fields that must all be set for the integration to count as configured */
  required: string[];
};

export const INTEGRATIONS: Record<GroupId, GroupDef> = {
  rapidapi: {
    title: "Video downloader (RapidAPI)",
    description:
      "Paid API behind the video, audio and platform downloaders. Without a key the downloader runs in demo mode with sample results.",
    docs: "https://rapidapi.com/developer/apps",
    required: ["RAPIDAPI_KEY", "RAPIDAPI_HOST", "RAPIDAPI_ENDPOINT"],
    fields: {
      RAPIDAPI_KEY: { label: "API key", secret: true, placeholder: "x-rapidapi-key from your RapidAPI app" },
      RAPIDAPI_HOST: { label: "Host", placeholder: "social-download-all-in-one.p.rapidapi.com" },
      RAPIDAPI_ENDPOINT: { label: "Endpoint URL", placeholder: "https://…p.rapidapi.com/v1/social/autolink" },
      RAPIDAPI_YT_HOST: { label: "YouTube host (optional)", placeholder: "Separate API for YouTube, if you use one" },
      RAPIDAPI_YT_ENDPOINT: { label: "YouTube endpoint (optional)", placeholder: "https://…" },
      RESOLVE_CACHE_TTL_MIN: { label: "Cache results for (minutes)", kind: "number", fallback: "60", hint: "Repeat links are served from cache and do not use your quota." },
    },
  },
  smtp: {
    title: "Email (SMTP)",
    description:
      "Sends contact-form messages to you and a confirmation to the visitor. For Gmail use smtp.gmail.com, port 465, secure on, and an App password.",
    docs: "https://support.google.com/accounts/answer/185833",
    required: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],
    fields: {
      SMTP_HOST: { label: "SMTP host", placeholder: "smtp.gmail.com / smtp.zoho.com" },
      SMTP_PORT: { label: "Port", kind: "number", fallback: "587", placeholder: "465 or 587" },
      SMTP_SECURE: { label: "Secure (SSL)", kind: "boolean", fallback: "false", hint: "On for port 465, off for 587 (STARTTLS)." },
      SMTP_USER: { label: "Username", placeholder: "you@yourdomain.com" },
      SMTP_PASS: { label: "Password / App password", secret: true },
      MAIL_FROM: { label: "From address", kind: "email", placeholder: "SnapGrab <support@yourdomain.com>" },
      MAIL_TO: { label: "Send contact messages to", kind: "email", placeholder: "you@gmail.com" },
    },
  },
  adsense: {
    title: "Google AdSense",
    description:
      "Shows ads in the reserved slots. Publisher ID loads the AdSense script (and Auto ads); the slot ID fills the in-page ad boxes. ads.txt is generated for you.",
    docs: "https://www.google.com/adsense",
    required: ["NEXT_PUBLIC_ADSENSE_CLIENT"],
    fields: {
      NEXT_PUBLIC_ADSENSE_CLIENT: { label: "Publisher ID", placeholder: "ca-pub-1234567890123456" },
      ADSENSE_SLOT: { label: "Display ad slot ID", placeholder: "1234567890", hint: "From AdSense → Ads → By ad unit → Display ad." },
    },
  },
  google: {
    title: "Google Search Console",
    description: "Verification code for the HTML-tag method, so you can submit the sitemap and see search traffic.",
    docs: "https://search.google.com/search-console",
    required: ["GOOGLE_SITE_VERIFICATION"],
    fields: {
      GOOGLE_SITE_VERIFICATION: { label: "Verification code", placeholder: "Only the content=\"…\" value of the meta tag" },
    },
  },
  rates: {
    title: "Exchange rates",
    description: "Free open API behind the currency converter. No key needed; the test checks the server can reach it.",
    docs: "https://www.exchangerate-api.com/docs/free",
    required: [],
    fields: {},
  },
};

export const ALL_FIELDS: Record<string, FieldDef & { group: GroupId }> = Object.fromEntries(
  (Object.entries(INTEGRATIONS) as [GroupId, GroupDef][]).flatMap(([group, g]) =>
    Object.entries(g.fields).map(([name, f]) => [name, { ...f, group }]),
  ),
);

/* ---------------------------- encryption ---------------------------- */

const PREFIX = "enc:v1:";

function cipherKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`snapgrab-integrations:${secret}`).digest();
}

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(":");
}

/** Returns null when the value cannot be decrypted (e.g. AUTH_SECRET changed). */
function decrypt(stored: string): string | null {
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const [iv, tag, data] = stored.slice(PREFIX.length).split(":").map((s) => Buffer.from(s, "base64"));
    const d = createDecipheriv("aes-256-gcm", cipherKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ---------------------------- reading ---------------------------- */

const KEY = (name: string) => `int:${name}`;
const TTL_MS = 10_000;
let memo: { at: number; values: Record<string, string | null> } | null = null;

/** Admin-panel values (decrypted). Cached briefly; saving clears the cache. */
async function adminValues(): Promise<Record<string, string | null>> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.values;
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: "int:" } } }).catch(() => []);
  const values = Object.fromEntries(rows.map((r) => [r.key.slice(4), decrypt(r.value)]));
  memo = { at: Date.now(), values };
  return values;
}

export type Source = "admin" | "env" | "default" | "unset";

/** Effective value: admin panel → .env → built-in default. */
export async function getIntegration(name: string): Promise<string | undefined> {
  const admin = (await adminValues())[name];
  if (admin) return admin;
  const env = process.env[name];
  if (env) return env;
  return ALL_FIELDS[name]?.fallback;
}

export async function getIntegrations<T extends string>(names: T[]): Promise<Record<T, string | undefined>> {
  const entries = await Promise.all(names.map(async (n) => [n, await getIntegration(n)] as const));
  return Object.fromEntries(entries) as Record<T, string | undefined>;
}

export async function isGroupConfigured(group: GroupId) {
  const vals = await getIntegrations(INTEGRATIONS[group].required);
  return INTEGRATIONS[group].required.every((n) => !!vals[n]);
}

/* ---------------------------- admin view ---------------------------- */

export type FieldView = FieldDef & {
  name: string;
  source: Source;
  /** plain value for non-secret fields; never set for secrets */
  value: string;
  /** for secrets: "…1234" when a value exists */
  masked: string | null;
  /** an admin value exists but cannot be decrypted with the current AUTH_SECRET */
  unreadable: boolean;
};

export type TestResult = { ok: boolean; message: string; detail?: string; at: string };

export type GroupView = Omit<GroupDef, "fields"> & {
  id: GroupId;
  configured: boolean;
  fields: FieldView[];
  lastTest: TestResult | null;
};

const mask = (v: string) => (v.length <= 4 ? "••••" : `••••${v.slice(-4)}`);

export async function getIntegrationViews(): Promise<GroupView[]> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: "int" } } }).catch(() => []);
  const stored = new Map(rows.map((r) => [r.key, r.value]));

  return Promise.all(
    (Object.entries(INTEGRATIONS) as [GroupId, GroupDef][]).map(async ([id, g]) => {
      const fields: FieldView[] = Object.entries(g.fields).map(([name, f]) => {
        const raw = stored.get(KEY(name));
        const admin = raw ? decrypt(raw) : null;
        const env = process.env[name];
        const source: Source = admin ? "admin" : env ? "env" : f.fallback ? "default" : "unset";
        const effective = admin || env || f.fallback || "";
        return {
          ...f,
          name,
          source,
          value: f.secret ? "" : effective,
          masked: f.secret && effective ? mask(effective) : null,
          unreadable: !!raw && admin === null,
        };
      });
      const lastRaw = stored.get(`int-test:${id}`);
      let lastTest: TestResult | null = null;
      try {
        lastTest = lastRaw ? (JSON.parse(lastRaw) as TestResult) : null;
      } catch {}
      const { fields: _defs, ...rest } = g;
      void _defs;
      return {
        ...rest,
        id,
        configured: g.required.every((n) => fields.find((f) => f.name === n)?.source !== "unset"),
        fields,
        lastTest,
      };
    }),
  );
}

/* ---------------------------- writing ---------------------------- */

/**
 * Save values for one group. `undefined` leaves a field alone, "" clears the admin value
 * (falling back to .env), anything else is stored (encrypted when secret).
 */
export async function saveIntegrations(group: GroupId, values: Record<string, string | undefined>) {
  const fields = INTEGRATIONS[group].fields;
  for (const [name, value] of Object.entries(values)) {
    if (!(name in fields) || value === undefined) continue;
    const v = value.trim();
    if (!v) {
      await prisma.setting.deleteMany({ where: { key: KEY(name) } });
      continue;
    }
    const stored = fields[name].secret ? encrypt(v) : v.slice(0, 500);
    await prisma.setting.upsert({ where: { key: KEY(name) }, create: { key: KEY(name), value: stored }, update: { value: stored } });
  }
  memo = null;
}

export async function saveTestResult(group: GroupId, result: Omit<TestResult, "at">) {
  const value = JSON.stringify({ ...result, at: new Date().toISOString() });
  await prisma.setting.upsert({ where: { key: `int-test:${group}` }, create: { key: `int-test:${group}`, value }, update: { value } });
}

/** Effective values for a group, with unsaved form values layered on top (for "Test before save"). */
export async function resolveGroup(group: GroupId, overrides: Record<string, string | undefined> = {}) {
  const names = Object.keys(INTEGRATIONS[group].fields);
  const current = await getIntegrations(names);
  for (const [k, v] of Object.entries(overrides)) {
    if (names.includes(k) && v !== undefined && v.trim()) current[k] = v.trim();
  }
  return current;
}
