import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TOOL_CATEGORIES } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Promo = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3).max(90),
  body: z.string().trim().max(240).optional(),
  url: z.string().trim().regex(/^https:\/\/\S+$/, "Link must start with https://").max(800),
  cta: z.string().trim().min(2).max(30).default("View deal"),
  categories: z.array(z.enum(TOOL_CATEGORIES as [string, ...string[]])).default([]),
  active: z.boolean().default(true),
});

async function guard() {
  return (await getSession()) ? null : NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = Promo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid promo." }, { status: 400 });
  const { id, categories, ...rest } = parsed.data;
  const data = { ...rest, body: rest.body || null, categories: categories.join(",") };
  if (id) await prisma.promo.update({ where: { id }, data });
  else await prisma.promo.create({ data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  if (id) await prisma.promo.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
