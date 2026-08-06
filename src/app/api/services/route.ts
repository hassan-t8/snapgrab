import { NextResponse } from "next/server";
import { getEnabledPlatforms, getEnabledTools } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public catalogue of live services. The mobile app calls this on launch so an
 * admin switching something off hides it in the app too, without a new release.
 */
export async function GET() {
  try {
    const [tools, platforms] = await Promise.all([getEnabledTools(), getEnabledPlatforms()]);

    return NextResponse.json({
      ok: true,
      data: {
        platforms: platforms.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          color: p.color,
          blurb: p.blurb,
          hosts: p.hosts,
          formats: p.formats,
        })),
        tools: tools.map((t) => ({
          slug: t.slug,
          name: t.name,
          category: t.category,
          tagline: t.tagline,
          color: t.color,
          engine: t.engine,
          mode: t.mode ?? null,
          outputs: t.outputs,
        })),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not load services." }, { status: 500 });
  }
}
