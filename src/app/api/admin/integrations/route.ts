import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { INTEGRATIONS, getIntegrationViews, saveIntegrations, type GroupId } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROUPS = Object.keys(INTEGRATIONS) as [GroupId, ...GroupId[]];

const Body = z.object({
  group: z.enum(GROUPS),
  // undefined = leave alone, "" = clear (fall back to .env), anything else = save
  values: z.record(z.string(), z.string().max(2000).optional()),
});

/** Field formats that are easy to get wrong; checked before anything is stored. */
const FORMAT: Record<string, { re: RegExp; message: string }> = {
  NEXT_PUBLIC_ADSENSE_CLIENT: { re: /^ca-pub-\d{10,20}$/, message: "Publisher ID looks like ca-pub-1234567890123456." },
  ADSENSE_SLOT: { re: /^\d{6,15}$/, message: "Slot ID is the number from your ad unit, e.g. 1234567890." },
  RAPIDAPI_ENDPOINT: { re: /^https:\/\/\S+$/, message: "Endpoint must be a full https:// URL." },
  RAPIDAPI_YT_ENDPOINT: { re: /^https:\/\/\S+$/, message: "YouTube endpoint must be a full https:// URL." },
  SMTP_PORT: { re: /^\d{2,5}$/, message: "Port is a number such as 465 or 587." },
  SMTP_SECURE: { re: /^(true|false)$/, message: "Secure must be on or off." },
  RESOLVE_CACHE_TTL_MIN: { re: /^\d{1,5}$/, message: "Cache time is a whole number of minutes." },
  GOOGLE_SITE_VERIFICATION: { re: /^[\w-]{10,100}$/, message: "Paste only the content value of the meta tag, not the whole tag." },
};

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, groups: await getIntegrationViews() });
}

export async function PATCH(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const { group, values } = parsed.data;
  for (const [name, value] of Object.entries(values)) {
    const rule = FORMAT[name];
    if (rule && value && value.trim() && !rule.re.test(value.trim())) {
      return NextResponse.json({ ok: false, error: rule.message, field: name }, { status: 400 });
    }
  }

  try {
    await saveIntegrations(group, values);
  } catch (err) {
    const msg = err instanceof Error && /AUTH_SECRET/.test(err.message) ? "AUTH_SECRET is missing on the server." : "Could not save. Check the database.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  // ad and verification settings are read by every public page
  ["/", "/tools"].forEach((p) => {
    try {
      revalidatePath(p, "layout");
    } catch {}
  });
  return NextResponse.json({ ok: true, groups: await getIntegrationViews() });
}
