import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveMedia, ProviderError } from "@/lib/provider";
import { touchVisitor } from "@/lib/tracking";
import { rateLimit } from "@/lib/ratelimit";
import { detectPlatform } from "@/lib/platforms";
import { isServiceEnabled } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ url: z.string().min(4).max(2048) });

export async function POST(req: Request) {
  const ctx = await touchVisitor();

  const limited = rateLimit(`resolve:${ctx.ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: `Too many requests. Try again in ${limited.retryAfter}s.` },
      { status: 429, headers: { "retry-after": String(limited.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please paste a valid link." }, { status: 400 });
  }

  // an admin can switch a platform off — a saved link must not bypass that
  const requested = detectPlatform(parsed.data.url);
  if (requested && !(await isServiceEnabled("platform", requested.id))) {
    return NextResponse.json(
      { ok: false, error: `The ${requested.name} downloader is temporarily unavailable. Please try again later.`, code: "DISABLED" },
      { status: 503 },
    );
  }

  try {
    const media = await resolveMedia(parsed.data.url);

    await prisma.download
      .create({
        data: {
          visitorId: ctx.visitorId,
          platform: media.platform,
          sourceUrl: media.sourceUrl,
          title: media.title,
          author: media.author,
          thumbnail: media.thumbnail,
          durationSec: media.durationSec,
          status: "resolved",
          ip: ctx.ip,
          country: ctx.country,
          userAgent: ctx.userAgent.slice(0, 400),
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true, data: media });
  } catch (err) {
    const isProvider = err instanceof ProviderError;
    const message = isProvider ? err.message : "Something went wrong while reading that link.";
    const platform = detectPlatform(parsed.data.url);

    await prisma.download
      .create({
        data: {
          visitorId: ctx.visitorId,
          platform: platform?.id ?? "unknown",
          sourceUrl: parsed.data.url.slice(0, 2000),
          status: "failed",
          errorMsg: message.slice(0, 300),
          ip: ctx.ip,
          country: ctx.country,
          userAgent: ctx.userAgent.slice(0, 400),
        },
      })
      .catch(() => {});

    return NextResponse.json(
      { ok: false, error: message, code: isProvider ? err.code : "INTERNAL" },
      {
        status:
          isProvider && (err.code === "UNSUPPORTED" || err.code === "BAD_URL")
            ? 400
            : isProvider && err.code === "QUOTA_EXCEEDED"
              ? 503
              : 502,
      },
    );
  }
}
