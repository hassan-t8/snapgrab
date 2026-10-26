import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SOCIALS } from "@/lib/socials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["site_tagline", "contact_email", "announcement", "lead_email", "lead_whatsapp", ...SOCIALS.map((s) => s.key)]);
const SOCIAL_KEYS = new Set<string>(SOCIALS.map((s) => s.key));

export async function POST(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  for (const [key, raw] of Object.entries(body)) {
    if (!ALLOWED.has(key)) continue;
    const value = String(raw ?? "").trim().slice(0, 500);
    if (key === "lead_email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return NextResponse.json({ ok: false, error: "Leads email is not a valid address." }, { status: 400 });
    }
    if (key === "lead_whatsapp" && value && !/^\+?\d[\d\s-]{9,16}$/.test(value)) {
      return NextResponse.json({ ok: false, error: "WhatsApp number should look like 923001234567." }, { status: 400 });
    }
    if (SOCIAL_KEYS.has(key) && value && !/^https:\/\/\S+$/.test(value)) {
      return NextResponse.json({ ok: false, error: `Social links must start with https:// (${key.replace("social_", "")}).` }, { status: 400 });
    }
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  return NextResponse.json({ ok: true });
}
