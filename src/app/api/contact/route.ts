import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendContactMail, mailerConfigured } from "@/lib/mailer";
import { touchVisitor } from "@/lib/tracking";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(2).max(80),
  email: z.email().max(160),
  subject: z.string().min(2).max(140),
  message: z.string().min(10).max(4000),
  website: z.string().optional(), // honeypot
});

export async function POST(req: Request) {
  const ctx = await touchVisitor();
  const limited = rateLimit(`contact:${ctx.ip}`, 5, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "You have sent several messages already. Please wait a few minutes." },
      { status: 429 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please fill in every field correctly." }, { status: 400 });
  }
  // silently accept bots so they do not retry
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const { name, email, subject, message } = parsed.data;

  await prisma.contactMessage.create({ data: { name, email, subject, message, ip: ctx.ip } });

  let mailed = false;
  try {
    const r = await sendContactMail({ name, email, subject, message, ip: ctx.ip });
    mailed = r.sent;
  } catch {
    mailed = false;
  }

  return NextResponse.json({
    ok: true,
    mailed,
    note: (await mailerConfigured())
      ? undefined
      : "Saved to the dashboard — SMTP is not configured yet, so no email was sent.",
  });
}
