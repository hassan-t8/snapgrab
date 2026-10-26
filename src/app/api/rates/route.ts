import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/tracking";
import { isServiceEnabled } from "@/lib/services";
import { getUsdRates } from "@/lib/fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isServiceEnabled("tool", "currency-converter"))) {
    return NextResponse.json({ ok: false, error: "The currency converter is temporarily unavailable." }, { status: 503 });
  }
  if (!rateLimit(`rates:${clientIp(req.headers)}`, 30, 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  }
  try {
    const { data, stale } = await getUsdRates();
    return NextResponse.json({ ok: true, data, stale });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Could not load rates." }, { status: 503 });
  }
}
