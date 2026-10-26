import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RATE_KEYS, type RateKey } from "@/lib/rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Save = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // null / empty = leave that price alone for the day
  values: z.record(z.string(), z.number().positive().max(10_000_000).nullable()),
});

export async function POST(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const parsed = Save.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter prices as plain numbers." }, { status: 400 });

  const date = new Date(`${parsed.data.date}T00:00:00Z`);
  let saved = 0;
  for (const [key, value] of Object.entries(parsed.data.values)) {
    if (!RATE_KEYS.includes(key as RateKey) || value == null) continue;
    await prisma.rateEntry.upsert({
      where: { key_date: { key, date } },
      create: { key, date, value },
      update: { value },
    });
    saved++;
  }
  return NextResponse.json({ ok: true, saved });
}

export async function DELETE(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  await prisma.rateEntry.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
