import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/tracking";
import { mailerConfigured, smtpConfig, transporter } from "@/lib/mailer";
import { escapeHtml } from "@/lib/escape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.enum(["solar"]),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,19}$/, "Enter a valid phone number."),
  city: z.string().trim().max(60).optional(),
  message: z.string().trim().max(600).optional(),
  details: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  // bots fill hidden fields
  website: z.string().max(0).optional(),
});

const LABEL = { solar: "Solar quote" } as const;

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`lead:${ip}`, 5, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Too many requests — please try again in a few minutes." }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." }, { status: 400 });
  }
  const { kind, name, phone, city, message, details } = parsed.data;

  const settings = Object.fromEntries(
    (await prisma.setting.findMany({ where: { key: { in: ["lead_email", "lead_whatsapp"] } } }).catch(() => [])).map((s) => [s.key, s.value.trim()]),
  );

  await prisma.lead.create({
    data: { kind, name, phone, city, message, details: details ? JSON.stringify(details).slice(0, 2000) : null, ip },
  });

  // email the business owner; a failure here must not lose the lead (it is already saved)
  try {
    const c = await smtpConfig();
    if (settings.lead_email && (await mailerConfigured(c))) {
      const rows = Object.entries(details ?? {})
        .map(([k, v]) => `<tr><td style="padding:4px 10px;color:#64748b">${escapeHtml(k)}</td><td style="padding:4px 10px"><b>${escapeHtml(String(v))}</b></td></tr>`)
        .join("");
      await transporter(c).sendMail({
        from: c.MAIL_FROM || c.SMTP_USER,
        to: settings.lead_email,
        subject: `New ${LABEL[kind]} request — ${name}${city ? `, ${city}` : ""}`,
        html: `<p><b>${escapeHtml(name)}</b> · ${escapeHtml(phone)}${city ? ` · ${escapeHtml(city)}` : ""}</p>
               ${message ? `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ""}
               ${rows ? `<table style="border-collapse:collapse;font-size:14px">${rows}</table>` : ""}
               <p style="color:#64748b;font-size:12px">From the SnapGrab ${escapeHtml(LABEL[kind])} form.</p>`,
      });
    }
  } catch {
    /* lead is stored; the admin panel shows it either way */
  }

  const wa = settings.lead_whatsapp?.replace(/[^\d]/g, "");
  return NextResponse.json({ ok: true, whatsapp: wa && wa.length >= 10 ? wa : null });
}
