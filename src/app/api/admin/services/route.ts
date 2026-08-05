import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { TOOL_MAP } from "@/lib/tools";
import { PLATFORM_MAP } from "@/lib/platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  updates: z
    .array(
      z.object({
        kind: z.enum(["tool", "platform"]),
        key: z.string().min(1).max(60),
        enabled: z.boolean(),
        note: z.string().max(300).optional(),
      }),
    )
    .min(1)
    .max(100),
});

function exists(kind: "tool" | "platform", key: string) {
  return kind === "tool" ? Boolean(TOOL_MAP[key]) : Boolean(PLATFORM_MAP[key]);
}

export async function PATCH(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const valid = parsed.data.updates.filter((u) => exists(u.kind, u.key));
  if (!valid.length) return NextResponse.json({ ok: false, error: "No known services in that request." }, { status: 400 });

  for (const u of valid) {
    const note = u.note?.trim() ? u.note.trim() : null;
    await prisma.serviceToggle.upsert({
      where: { kind_key: { kind: u.kind, key: u.key } },
      create: { key: u.key, kind: u.kind, enabled: u.enabled, note },
      update: { enabled: u.enabled, note },
    });
  }

  // the public pages read these on every request, but refresh any cached shells too
  ["/", "/tools", "/sitemap.xml"].forEach((p) => {
    try {
      revalidatePath(p);
    } catch {}
  });

  return NextResponse.json({ ok: true, updated: valid.length });
}
