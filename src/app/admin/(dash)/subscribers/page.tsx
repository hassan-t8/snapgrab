import { format } from "date-fns";
import { Mail, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { EmptyRow, Panel, StatCard } from "@/components/admin/ui";
import CopyEmails from "@/components/admin/CopyEmails";
import { isWithinDays } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function SubscribersPage() {
  const subs = await prisma.subscriber.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const last30 = subs.filter((s) => isWithinDays(s.createdAt, 30)).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total subscribers" value={subs.length} icon={<Users />} />
        <StatCard label="New in last 30 days" value={last30} icon={<Mail />} tone="accent" delay={0.05} />
      </div>

      <Panel title="Newsletter list" action={<CopyEmails emails={subs.map((s) => s.email)} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && <EmptyRow colSpan={2} message="No subscribers yet." />}
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-[var(--line)] last:border-0 hover:bg-brand-500/5">
                  <td className="px-5 py-3 font-medium">{s.email}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                    {format(s.createdAt, "d MMM yyyy, HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
