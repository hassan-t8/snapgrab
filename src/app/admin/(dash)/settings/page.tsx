import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Panel } from "@/components/admin/ui";
import { getIntegrationViews } from "@/lib/integrations";
import { SOCIALS } from "@/lib/socials";
import SettingsForm from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await prisma.setting.findMany().catch(() => []);
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const groups = await getIntegrationViews();

  return (
    <div className="space-y-5">
      <Panel
        title="Integrations & keys"
        action={
          <Link href="/admin/integrations" className="text-xs font-bold text-brand-400">
            Manage →
          </Link>
        }
      >
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {groups.map((g) => (
            <Link
              key={g.id}
              href="/admin/integrations"
              className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-soft)] px-4 py-3 text-sm transition-colors hover:bg-brand-500/10"
            >
              <span className="font-semibold">{g.title}</span>
              {g.required.length === 0 || g.configured ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-amber-400" />
              )}
            </Link>
          ))}
        </div>
        <p className="border-t border-[var(--line)] px-5 py-4 text-xs text-muted">
          API keys, SMTP email, AdSense and Search Console are set and tested on the Integrations page. Only the public
          site URL and database stay in the server&apos;s <code className="font-mono">.env</code>.
        </p>
      </Panel>

      <Panel title="Site content settings">
        <SettingsForm
          initial={{
            site_tagline: map.site_tagline ?? "",
            contact_email: map.contact_email ?? "",
            announcement: map.announcement ?? "",
            lead_email: map.lead_email ?? "",
            lead_whatsapp: map.lead_whatsapp ?? "",
            ...Object.fromEntries(SOCIALS.map((s) => [s.key, map[s.key] ?? ""])),
          }}
        />
      </Panel>
    </div>
  );
}
