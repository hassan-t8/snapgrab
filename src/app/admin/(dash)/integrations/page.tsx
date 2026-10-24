import { ShieldCheck } from "lucide-react";
import IntegrationsManager from "@/components/admin/IntegrationsManager";
import { getIntegrationViews } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const groups = await getIntegrationViews();
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-brand-500/25 bg-brand-500/5 p-4 text-sm text-muted">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
        <p>
          Keys saved here are <strong className="text-[var(--fg)]">encrypted</strong> and take effect within seconds — no
          redeploy. They override the same setting in the server&apos;s <code className="font-mono">.env</code>; remove a saved
          value to fall back to it. Use <strong className="text-[var(--fg)]">Test</strong> after every change.
        </p>
      </div>
      <IntegrationsManager groups={groups} />
    </div>
  );
}
