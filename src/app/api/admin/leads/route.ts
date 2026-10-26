import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ id: z.string().min(1), status: z.enum(["new", "contacted", "closed"]) });

export async function PATCH(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  await prisma.lead.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
  return NextResponse.json({ ok: true });
}
