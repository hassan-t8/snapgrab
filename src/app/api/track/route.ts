import { NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { touchVisitor, clientIp } from "@/lib/tracking";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ path: z.string().max(300), first: z.boolean().optional() });

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

    const ip = clientIp(await headers());
    if (!rateLimit(`track:${ip}`, 120, 60_000).ok) return NextResponse.json({ ok: true, throttled: true });

    await touchVisitor({ path: parsed.data.path, countVisit: parsed.data.first });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
