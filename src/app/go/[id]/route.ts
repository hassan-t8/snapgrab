import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Counts a click on a sponsored/affiliate box, then sends the visitor to the partner link. */
export async function GET(_req: Request, { params }: RouteContext<"/go/[id]">) {
  const { id } = await params;
  const promo = await prisma.promo.update({ where: { id }, data: { clicks: { increment: 1 } } }).catch(() => null);
  if (!promo || !promo.active || !/^https:\/\//.test(promo.url)) return NextResponse.redirect(new URL("/tools", _req.url), 302);
  return NextResponse.redirect(promo.url, { status: 302, headers: { "x-robots-tag": "noindex, nofollow" } });
}
