import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { touchVisitor } from "@/lib/tracking";
import { rateLimit } from "@/lib/ratelimit";
import { TOOL_MAP } from "@/lib/tools";
import { isServiceEnabled } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  tool: z.string().max(60),
  inputType: z.string().max(60).optional(),
  outputType: z.string().max(60).optional(),
  files: z.number().int().min(1).max(500).optional(),
  bytesIn: z.number().int().min(0).optional(),
  bytesOut: z.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success || !TOOL_MAP[parsed.data.tool]) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (!(await isServiceEnabled("tool", parsed.data.tool))) {
      return NextResponse.json({ ok: false, error: "Service disabled" }, { status: 503 });
    }

    const ctx = await touchVisitor();
    if (!rateLimit(`tool:${ctx.ip}`, 60, 60_000).ok) {
      return NextResponse.json({ ok: true, throttled: true });
    }

    const { tool, inputType, outputType, files, bytesIn, bytesOut } = parsed.data;
    await prisma.toolUsage.create({
      data: {
        tool,
        inputType,
        outputType,
        files: files ?? 1,
        bytesIn,
        bytesOut,
        visitorId: ctx.visitorId,
        ip: ctx.ip,
        country: ctx.country,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // analytics must never break a conversion the user already completed
    return NextResponse.json({ ok: true });
  }
}
