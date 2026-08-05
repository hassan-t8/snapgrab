import { NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { verifyCredentials, createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(await headers());
  const limited = rateLimit(`login:${ip}`, 8, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Wait 10 minutes." }, { status: 429 });
  }

  const parsed = z
    .object({ email: z.string().min(3), password: z.string().min(1) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Missing credentials." }, { status: 400 });

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });

  await createSession(user);
  return NextResponse.json({ ok: true });
}
