import { format } from "date-fns";
import { Mail, MailOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Panel, StatCard } from "@/components/admin/ui";
import MessageList from "@/components/admin/MessageList";

export const dynamic = "force-dynamic";

export default async function AdminMessages() {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const unhandled = messages.filter((m) => !m.handled).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total messages" value={messages.length} icon={<Mail />} />
        <StatCard
          label="Awaiting reply"
          value={unhandled}
          icon={<MailOpen />}
          tone={unhandled ? "red" : "accent"}
          delay={0.05}
        />
      </div>

      <Panel title="Inbox">
        <MessageList
          messages={messages.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            subject: m.subject,
            message: m.message,
            ip: m.ip,
            handled: m.handled,
            createdAt: format(m.createdAt, "d MMM yyyy, HH:mm"),
          }))}
        />
      </Panel>
    </div>
  );
}
