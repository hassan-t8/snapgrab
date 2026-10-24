import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { updateQuota } from "@/lib/quota";
import { QUOTA_PROVIDERS, type ProviderId } from "@/lib/quota-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  provider: z.string().refine((v): v is ProviderId => v in QUOTA_PROVIDERS, "Unknown provider"),
  limit: z.number().int().min(1).max(100_000_000).nullable().optional(),
  period: z.enum(["day", "month"]).optional(),
  forceEnabled: z.boolean().optional(),
  reset: z.boolean().optional(),
  renewsAt: z.iso.datetime().nullable().optional(),
});

export async function PATCH(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const { provider, renewsAt, ...rest } = parsed.data;
  if (renewsAt && new Date(renewsAt) <= new Date()) {
    return NextResponse.json({ ok: false, error: "The renewal date must be in the future." }, { status: 400 });
  }

  try {
    const state = await updateQuota(provider as ProviderId, {
      ...rest,
      renewsAt: renewsAt === undefined ? undefined : renewsAt ? new Date(renewsAt) : null,
    });
    ["/", "/tools"].forEach((p) => {
      try {
        revalidatePath(p);
      } catch {}
    });
    return NextResponse.json({ ok: true, state });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not save. Check the database connection." }, { status: 500 });
  }
}
