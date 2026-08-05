import nodemailer from "nodemailer";
import { escapeHtml } from "./escape";

export function mailerConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: String(process.env.SMTP_SECURE ?? "false") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
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
  if (!mailerConfigured()) return { sent: false, reason: "SMTP not configured" };
  const t = transporter();

  await t.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_TO,
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
    from: process.env.MAIL_FROM,
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

