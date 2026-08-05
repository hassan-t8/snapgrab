import { CheckCircle2, KeyRound, Mail, Megaphone, Server, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Panel } from "@/components/admin/ui";
import { isDemoMode } from "@/lib/provider";
import { mailerConfigured } from "@/lib/mailer";
import SettingsForm from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await prisma.setting.findMany().catch(() => []);
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const env = [
    {
      icon: KeyRound,
      label: "RapidAPI provider",
      ok: !isDemoMode(),
      value: isDemoMode() ? "Not configured — demo mode" : process.env.RAPIDAPI_HOST,
      hint: "RAPIDAPI_KEY, RAPIDAPI_HOST, RAPIDAPI_ENDPOINT",
    },
    {
      icon: Mail,
      label: "SMTP mailer",
      ok: mailerConfigured(),
      value: mailerConfigured() ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT}` : "Not configured",
      hint: "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO",
    },
    {
      icon: Megaphone,
      label: "Google AdSense",
      ok: Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT),
      value: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "Placeholder slots shown",
      hint: "NEXT_PUBLIC_ADSENSE_CLIENT",
    },
    {
      icon: Server,
      label: "Public site URL",
      ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      value: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      hint: "NEXT_PUBLIC_SITE_URL — used for canonical URLs and the sitemap",
    },
  ];

  return (
    <div className="space-y-5">
      <Panel title="Environment status">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {env.map((e) => (
            <div key={e.label} className="flex gap-3 rounded-xl bg-[var(--bg-soft)] p-4">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                  e.ok ? "bg-accent-500/15 text-accent-400" : "bg-amber-500/15 text-amber-400"
                }`}
              >
                <e.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  {e.label}
                  {e.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-amber-400" />
                  )}
                </p>
                <p className="mt-0.5 break-all text-xs text-muted">{e.value}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-muted opacity-70">{e.hint}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="border-t border-[var(--line)] px-5 py-4 text-xs text-muted">
          These come from environment variables and cannot be edited from the browser. Change them in{" "}
          <code className="font-mono">.env</code> (or your host&apos;s dashboard) and restart the app.
        </p>
      </Panel>

      <Panel title="Site content settings">
        <SettingsForm
          initial={{
            site_tagline: map.site_tagline ?? "",
            contact_email: map.contact_email ?? "",
            announcement: map.announcement ?? "",
          }}
        />
      </Panel>
    </div>
  );
}
