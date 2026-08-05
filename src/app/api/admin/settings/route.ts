import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["site_tagline", "contact_email", "announcement"]);

export async function POST(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  for (const [key, raw] of Object.entries(body)) {
    if (!ALLOWED.has(key)) continue;
    const value = String(raw ?? "").slice(0, 500);
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  return NextResponse.json({ ok: true });
}
