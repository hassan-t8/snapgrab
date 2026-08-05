import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/tracking";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(await headers());
  if (!rateLimit(`sub:${ip}`, 5, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Please try again later." }, { status: 429 });
  }
  const parsed = z.object({ email: z.email() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });

  await prisma.subscriber
    .upsert({ where: { email: parsed.data.email }, create: { email: parsed.data.email }, update: {} })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
