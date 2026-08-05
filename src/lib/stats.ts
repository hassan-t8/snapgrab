import { prisma } from "./prisma";

const day = 86_400_000;

export type Overview = Awaited<ReturnType<typeof getOverview>>;

function since(days: number) {
  return new Date(Date.now() - days * day);
}

export async function getOverview() {
  const d1 = since(1);
  const d7 = since(7);
  const d30 = since(30);
  const prev7 = new Date(Date.now() - 14 * day);

  const [
    totalDownloads,
    downloads24h,
    downloads7d,
    downloadsPrev7d,
    failed7d,
    totalVisitors,
    visitors24h,
    visitors7d,
    pageViews7d,
    apiCalls30d,
    apiFailed30d,
    cachedCalls30d,
    messages,
    unhandled,
    subscribers,
    posts,
  ] = await Promise.all([
    prisma.download.count(),
    prisma.download.count({ where: { createdAt: { gte: d1 } } }),
    prisma.download.count({ where: { createdAt: { gte: d7 } } }),
    prisma.download.count({ where: { createdAt: { gte: prev7, lt: d7 } } }),
    prisma.download.count({ where: { createdAt: { gte: d7 }, status: "failed" } }),
    prisma.visitor.count(),
    prisma.visitor.count({ where: { lastSeen: { gte: d1 } } }),
    prisma.visitor.count({ where: { lastSeen: { gte: d7 } } }),
    prisma.pageView.count({ where: { createdAt: { gte: d7 } } }),
    prisma.apiCall.count({ where: { createdAt: { gte: d30 } } }),
    prisma.apiCall.count({ where: { createdAt: { gte: d30 }, ok: false } }),
    prisma.apiCall.count({ where: { createdAt: { gte: d30 }, cached: true } }),
    prisma.contactMessage.count(),
    prisma.contactMessage.count({ where: { handled: false } }),
    prisma.subscriber.count(),
    prisma.blogPost.count(),
  ]);

  const latency = await prisma.apiCall.aggregate({
    where: { createdAt: { gte: d30 }, cached: false },
    _avg: { latencyMs: true },
  });

  const growth =
    downloadsPrev7d === 0 ? (downloads7d > 0 ? 100 : 0) : Math.round(((downloads7d - downloadsPrev7d) / downloadsPrev7d) * 100);

  return {
    totalDownloads,
    downloads24h,
    downloads7d,
    growth,
    successRate: downloads7d ? Math.round(((downloads7d - failed7d) / downloads7d) * 100) : 100,
    totalVisitors,
    visitors24h,
    visitors7d,
    pageViews7d,
    apiCalls30d,
    apiFailed30d,
    cachedCalls30d,
    cacheHitRate: apiCalls30d ? Math.round((cachedCalls30d / apiCalls30d) * 100) : 0,
    avgLatency: Math.round(latency._avg.latencyMs ?? 0),
    messages,
    unhandled,
    subscribers,
    posts,
  };
}

/** Downloads + visitors per day for the last N days, zero-filled. */
export async function getTimeSeries(days = 14) {
  const start = new Date(Date.now() - (days - 1) * day);
  start.setHours(0, 0, 0, 0);

  const [downloads, views] = await Promise.all([
    prisma.download.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true, status: true } }),
    prisma.pageView.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
  ]);

  const buckets = new Map<string, { date: string; downloads: number; failed: number; views: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * day);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, downloads: 0, failed: 0, views: 0 });
  }

  for (const d of downloads) {
    const b = buckets.get(d.createdAt.toISOString().slice(0, 10));
    if (!b) continue;
    if (d.status === "failed") b.failed += 1;
    else b.downloads += 1;
  }
  for (const v of views) {
    const b = buckets.get(v.createdAt.toISOString().slice(0, 10));
    if (b) b.views += 1;
  }

  return [...buckets.values()];
}

export async function getPlatformBreakdown() {
  const rows = await prisma.download.groupBy({
    by: ["platform"],
    _count: { _all: true },
    orderBy: { _count: { platform: "desc" } },
  });
  return rows.map((r) => ({ platform: r.platform, count: r._count._all }));
}

export async function getCountryBreakdown(limit = 8) {
  const rows = await prisma.visitor.groupBy({
    by: ["country"],
    _count: { _all: true },
    orderBy: { _count: { country: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ country: r.country ?? "Unknown", count: r._count._all }));
}

export async function getDeviceBreakdown() {
  const rows = await prisma.visitor.groupBy({ by: ["device"], _count: { _all: true } });
  return rows.map((r) => ({ device: r.device ?? "unknown", count: r._count._all }));
}

export async function getTopPages(limit = 8) {
  const rows = await prisma.pageView.groupBy({
    by: ["path"],
    _count: { _all: true },
    orderBy: { _count: { path: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ path: r.path, count: r._count._all }));
}
