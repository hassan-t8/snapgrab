import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchVisitor } from "@/lib/tracking";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Block SSRF into the local network — we only ever proxy public CDN media. */
function isSafeRemote(u: URL) {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return false;
  return true;
}

function safeName(name: string, ext: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 70)
    .replace(/^-+|-+$/g, "");
  return `${base || "snapgrab-download"}.${ext.replace(/[^a-z0-9]/gi, "") || "mp4"}`;
}

export async function GET(req: Request) {
  const ctx = await touchVisitor();
  const limited = rateLimit(`dl:${ctx.ip}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "Too many downloads. Slow down a little." }, { status: 429 });
  }

  const params = new URL(req.url).searchParams;
  const target = params.get("url");
  const title = params.get("title") ?? "snapgrab-download";
  const ext = params.get("ext") ?? "mp4";
  const platform = params.get("platform") ?? "unknown";
  const quality = params.get("quality") ?? undefined;
  const kind = params.get("kind") ?? "video";
  const source = params.get("source") ?? "";

  if (!target) return NextResponse.json({ ok: false, error: "Missing url." }, { status: 400 });

  let remote: URL;
  try {
    remote = new URL(target);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid url." }, { status: 400 });
  }
  if (!isSafeRemote(remote)) {
    return NextResponse.json({ ok: false, error: "Blocked destination." }, { status: 400 });
  }

  try {
    const upstream = await fetch(remote, {
      headers: {
        // some CDNs require a browser-ish UA / range support
        "user-agent": "Mozilla/5.0 (compatible; SnapGrab/1.0)",
        accept: "*/*",
        ...(req.headers.get("range") ? { range: req.headers.get("range") as string } : {}),
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      throw new Error(`upstream ${upstream.status}`);
    }

    const size = Number(upstream.headers.get("content-length") ?? 0) || undefined;

    await prisma.download
      .create({
        data: {
          visitorId: ctx.visitorId,
          platform,
          sourceUrl: source || remote.toString(),
          title,
          quality,
          ext,
          kind,
          sizeBytes: size,
          status: "downloaded",
          ip: ctx.ip,
          country: ctx.country,
          userAgent: ctx.userAgent.slice(0, 400),
        },
      })
      .catch(() => {});

    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") ?? "application/octet-stream");
    headers.set("content-disposition", `attachment; filename="${safeName(title, ext)}"`);
    headers.set("cache-control", "no-store");
    if (upstream.headers.get("content-length")) headers.set("content-length", upstream.headers.get("content-length") as string);
    if (upstream.headers.get("content-range")) headers.set("content-range", upstream.headers.get("content-range") as string);
    headers.set("accept-ranges", "bytes");

    return new NextResponse(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch (err) {
    await prisma.download
      .create({
        data: {
          visitorId: ctx.visitorId,
          platform,
          sourceUrl: source || remote.toString(),
          title,
          status: "failed",
          errorMsg: (err instanceof Error ? err.message : "download failed").slice(0, 300),
          ip: ctx.ip,
          country: ctx.country,
        },
      })
      .catch(() => {});
    return NextResponse.json(
      { ok: false, error: "That media link expired. Please resolve the URL again." },
      { status: 502 },
    );
  }
}
