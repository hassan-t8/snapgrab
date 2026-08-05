import { cache } from "react";
import { prisma } from "./prisma";
import { PLATFORMS, type Platform } from "./platforms";
import { TOOLS, type Tool } from "./tools";

export type ServiceKind = "tool" | "platform";

export type ServiceState = { enabled: boolean; note: string | null };

/**
 * Toggles are opt-out: a service with no row is enabled. That way adding a new
 * tool or platform never requires a migration or a seed to become visible.
 *
 * `cache` de-duplicates the query across a single render pass.
 */
export const getServiceStates = cache(async (): Promise<Record<string, ServiceState>> => {
  try {
    const rows = await prisma.serviceToggle.findMany();
    return Object.fromEntries(rows.map((r) => [`${r.kind}:${r.key}`, { enabled: r.enabled, note: r.note }]));
  } catch {
    // never take the site down because the toggle table is unreachable
    return {};
  }
});

export async function getServiceState(kind: ServiceKind, key: string): Promise<ServiceState> {
  const states = await getServiceStates();
  return states[`${kind}:${key}`] ?? { enabled: true, note: null };
}

export async function isServiceEnabled(kind: ServiceKind, key: string): Promise<boolean> {
  return (await getServiceState(kind, key)).enabled;
}

export async function getEnabledTools(): Promise<Tool[]> {
  const states = await getServiceStates();
  return TOOLS.filter((t) => states[`tool:${t.slug}`]?.enabled !== false);
}

export async function getEnabledPlatforms(): Promise<Platform[]> {
  const states = await getServiceStates();
  return PLATFORMS.filter((p) => states[`platform:${p.id}`]?.enabled !== false);
}

/** Lightweight shape for passing into client components (nav, footer, grids). */
export type ServiceSummary = { toolSlugs: string[]; platformIds: string[] };

export async function getEnabledSummary(): Promise<ServiceSummary> {
  const [tools, platforms] = await Promise.all([getEnabledTools(), getEnabledPlatforms()]);
  return { toolSlugs: tools.map((t) => t.slug), platformIds: platforms.map((p) => p.id) };
}

export async function getServiceCounts() {
  const states = await getServiceStates();
  const disabledTools = TOOLS.filter((t) => states[`tool:${t.slug}`]?.enabled === false).length;
  const disabledPlatforms = PLATFORMS.filter((p) => states[`platform:${p.id}`]?.enabled === false).length;
  return {
    totalTools: TOOLS.length,
    totalPlatforms: PLATFORMS.length,
    disabledTools,
    disabledPlatforms,
    enabledTools: TOOLS.length - disabledTools,
    enabledPlatforms: PLATFORMS.length - disabledPlatforms,
  };
}
