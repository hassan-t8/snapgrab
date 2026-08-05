import { cookies, headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { prisma } from "./prisma";

export const ANON_COOKIE = "sg_aid";

export function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-vercel-forwarded-for") ??
    "0.0.0.0"
  );
}

export function geoFromHeaders(h: Headers) {
  return {
    country: h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? undefined,
    city: decodeMaybe(h.get("x-vercel-ip-city")) ?? undefined,
    region: h.get("x-vercel-ip-country-region") ?? undefined,
  };
}

function decodeMaybe(v: string | null) {
  if (!v) return undefined;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export type VisitorContext = {
  visitorId: string | null;
  ip: string;
  country?: string;
  userAgent: string;
};

/**
 * Upserts the visitor row for the current request and returns its id.
 * Safe to call from any route handler — never throws.
 */
export async function touchVisitor(opts: { path?: string; countVisit?: boolean } = {}): Promise<VisitorContext> {
  const h = await headers();
  const ip = clientIp(h);
  const userAgent = h.get("user-agent") ?? "unknown";
  const geo = geoFromHeaders(h);
  const referrer = h.get("referer") ?? undefined;

  try {
    const jar = await cookies();
    let anonId = jar.get(ANON_COOKIE)?.value;
    if (!anonId) {
      anonId = crypto.randomUUID();
      jar.set(ANON_COOKIE, anonId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }

    const ua = UAParser(userAgent);
    const visitor = await prisma.visitor.upsert({
      where: { anonId },
      create: {
        anonId,
        ip,
        userAgent,
        referrer,
        landingPath: opts.path,
        browser: ua.browser.name,
        os: ua.os.name,
        device: ua.device.type ?? "desktop",
        ...geo,
      },
      update: {
        ip,
        userAgent,
        ...geo,
        ...(opts.countVisit ? { visits: { increment: 1 } } : {}),
      },
    });

    if (opts.path) {
      await prisma.pageView.create({
        data: { visitorId: visitor.id, path: opts.path, referrer },
      });
    }

    return { visitorId: visitor.id, ip, country: geo.country, userAgent };
  } catch {
    return { visitorId: null, ip, country: geo.country, userAgent };
  }
}
