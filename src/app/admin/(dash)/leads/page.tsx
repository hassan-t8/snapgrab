import Link from "next/link";
import { format } from "date-fns";
import { BrandWhatsApp } from "@/components/BrandIcons";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyRow, Panel } from "@/components/admin/ui";
import LeadStatus from "@/components/admin/LeadStatus";

export const dynamic = "force-dynamic";

export default async function AdminLeads() {
  const [leads, settings] = await Promise.all([
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 }).catch(() => []),
    prisma.setting.findMany({ where: { key: { in: ["lead_email", "lead_whatsapp"] } } }).catch(() => []),
  ]);
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]));
  const open = leads.filter((l) => l.status === "new").length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl surface p-4 text-sm text-muted">
        Leads come from the <strong className="text-[var(--fg)]">“Get a free solar quote”</strong> form on the Solar load
        calculator. New leads are emailed to <strong className="text-[var(--fg)]">{s.lead_email || "— not set —"}</strong> and visitors can
        continue on WhatsApp <strong className="text-[var(--fg)]">{s.lead_whatsapp || "— not set —"}</strong>. Change both in{" "}
        <Link href="/admin/settings" className="font-semibold text-brand-400 underline">
          Settings
        </Link>
        .
      </div>
      <Panel title={`${leads.length} leads · ${open} new`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Person</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && <EmptyRow colSpan={4} message="No leads yet." />}
              {leads.map((l) => {
                let details: Record<string, unknown> = {};
                try {
                  details = l.details ? (JSON.parse(l.details) as Record<string, unknown>) : {};
                } catch {}
                const wa = l.phone.replace(/[^\d]/g, "").replace(/^0/, "92");
                return (
                  <tr key={l.id} className="border-b border-[var(--line)] align-top last:border-0">
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">{format(l.createdAt, "d MMM, HH:mm")}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold">{l.name}</p>
                      <p className="text-xs text-muted">
                        {l.phone}
                        {l.city ? ` · ${l.city}` : ""}
                      </p>
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#25D366]">
                        <BrandWhatsApp className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <Badge>{l.kind}</Badge>
                      {l.message && <p className="mt-1 whitespace-pre-wrap">{l.message}</p>}
                      <ul className="mt-1 space-y-0.5 text-muted">
                        {Object.entries(details).map(([k, v]) => (
                          <li key={k}>
                            {k}: <span className="text-[var(--fg)]">{String(v)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-5 py-3">
                      <LeadStatus id={l.id} status={l.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
