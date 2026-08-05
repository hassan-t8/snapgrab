import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id, handled } = (await req.json().catch(() => ({}))) as { id?: string; handled?: boolean };
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  await prisma.contactMessage.update({ where: { id }, data: { handled: Boolean(handled) } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  await prisma.contactMessage.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
