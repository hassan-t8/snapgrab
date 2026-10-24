import nodemailer from "nodemailer";
import { escapeHtml } from "./escape";
import { getIntegrations } from "./integrations";

const SMTP_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "MAIL_TO"] as const;
export type SmtpConfig = Record<(typeof SMTP_KEYS)[number], string | undefined>;

/** SMTP settings from Admin → Integrations, falling back to .env. */
export const smtpConfig = () => getIntegrations([...SMTP_KEYS]);

export async function mailerConfigured(cfg?: SmtpConfig) {
  const c = cfg ?? (await smtpConfig());
  return Boolean(c.SMTP_HOST && c.SMTP_USER && c.SMTP_PASS);
}

export function transporter(c: SmtpConfig) {
  return nodemailer.createTransport({
    host: c.SMTP_HOST,
    port: Number(c.SMTP_PORT ?? 587),
    secure: String(c.SMTP_SECURE ?? "false") === "true",
    auth: { user: c.SMTP_USER, pass: c.SMTP_PASS },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
  });
}

const shell = (title: string, body: string) => `
<div style="background:#0b1020;padding:32px 16px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.25)">
    <div style="background:linear-gradient(135deg,#6d28d9,#2563eb);padding:24px 28px;color:#fff">
      <div style="font-size:20px;font-weight:700;letter-spacing:-.02em">${process.env.NEXT_PUBLIC_SITE_NAME ?? "SnapGrab"}</div>
      <div style="opacity:.85;font-size:13px;margin-top:2px">${title}</div>
    </div>
    <div style="padding:28px;color:#0f172a;font-size:15px;line-height:1.6">${body}</div>
    <div style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px">
      Sent automatically by ${process.env.NEXT_PUBLIC_SITE_NAME ?? "SnapGrab"}.
    </div>
  </div>
</div>`;

export async function sendContactMail(msg: {
  name: string;
  email: string;
  subject: string;
  message: string;
  ip?: string;
}) {
  const c = await smtpConfig();
  if (!(await mailerConfigured(c))) return { sent: false, reason: "SMTP not configured" };
  const t = transporter(c);
  const from = c.MAIL_FROM || c.SMTP_USER;

  await t.sendMail({
    from,
    to: c.MAIL_TO || c.SMTP_USER,
    replyTo: `${msg.name} <${msg.email}>`,
    subject: `[Contact] ${msg.subject}`,
    html: shell(
      "New contact message",
      `<p><b>From:</b> ${escapeHtml(msg.name)} &lt;${escapeHtml(msg.email)}&gt;</p>
       <p><b>Subject:</b> ${escapeHtml(msg.subject)}</p>
       <p style="white-space:pre-wrap;background:#f1f5f9;padding:14px;border-radius:10px">${escapeHtml(msg.message)}</p>
       <p style="color:#64748b;font-size:12px">IP: ${escapeHtml(msg.ip ?? "unknown")}</p>`,
    ),
  });

  await t.sendMail({
    from,
    to: msg.email,
    subject: "We received your message",
    html: shell(
      "Thanks for reaching out",
      `<p>Hi ${escapeHtml(msg.name)},</p>
       <p>Your message reached our team and we usually reply within one business day.</p>
       <p style="white-space:pre-wrap;background:#f1f5f9;padding:14px;border-radius:10px">${escapeHtml(msg.message)}</p>
       <p>— The ${process.env.NEXT_PUBLIC_SITE_NAME ?? "SnapGrab"} team</p>`,
    ),
  });

  return { sent: true };
}


/** Sends the admin "Test email" message; throws with the SMTP server's own error text on failure. */
export async function sendTestMail(c: SmtpConfig, to: string) {
  const t = transporter(c);
  await t.verify();
  const info = await t.sendMail({
    from: c.MAIL_FROM || c.SMTP_USER,
    to,
    subject: "SnapGrab test email ✔",
    html: shell(
      "SMTP test",
      `<p>This is a test from <b>Admin → Integrations</b>.</p>
       <p>If you can read this, contact-form emails will be delivered.</p>
       <p style="color:#64748b;font-size:12px">Server: ${escapeHtml(String(c.SMTP_HOST))}:${escapeHtml(String(c.SMTP_PORT ?? 587))}</p>`,
    ),
  });
  return info.messageId as string;
}
