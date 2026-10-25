import { cache } from "react";
import { prisma } from "./prisma";
import { SOCIALS, type SocialKey } from "./socials";

export type SiteSettings = {
  contactEmail: string;
  socials: Partial<Record<SocialKey, string>>;
};

/** Public site settings edited in Admin → Settings. De-duplicated per render; never throws. */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await prisma.setting
    .findMany({ where: { key: { in: ["contact_email", ...SOCIALS.map((s) => s.key)] } } })
    .catch(() => []);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value.trim()]));
  const socials: SiteSettings["socials"] = {};
  for (const s of SOCIALS) if (/^https:\/\/\S+$/.test(map[s.key] ?? "")) socials[s.key] = map[s.key];
  return { contactEmail: map.contact_email || "support@snapgrab.app", socials };
});
