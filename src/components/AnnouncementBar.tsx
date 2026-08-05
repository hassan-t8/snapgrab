import { Megaphone } from "lucide-react";
import { prisma } from "@/lib/prisma";

/** Rendered only when an admin has set a non-empty announcement in the dashboard. */
export default async function AnnouncementBar() {
  const setting = await prisma.setting.findUnique({ where: { key: "announcement" } }).catch(() => null);
  const text = setting?.value?.trim();
  if (!text) return null;

  return (
    <div className="relative z-40 bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-center text-sm font-medium text-white">
      <span className="inline-flex items-center gap-2">
        <Megaphone className="h-4 w-4 shrink-0" />
        {text}
      </span>
    </div>
  );
}
