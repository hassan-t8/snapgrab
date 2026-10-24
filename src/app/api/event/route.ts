import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { touchVisitor } from "@/lib/tracking";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/),
  label: z.string().max(80).optional(),
  path: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid event." }, { status: 400 });
  }

  try {
    const ctx = await touchVisitor();
    // a page full of buttons should not be able to flood the table
    if (!rateLimit(`event:${ctx.ip}`, 120, 60_000).ok) {
      return NextResponse.json({ ok: true, throttled: true });
    }

    await prisma.event.create({
      data: {
        name: parsed.data.name,
        label: parsed.data.label,
        path: parsed.data.path,
        visitorId: ctx.visitorId,
        country: ctx.country,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    // analytics must never surface as an error to the visitor
    return NextResponse.json({ ok: true });
  }
}
