import { ImageResponse } from "next/og";

export const runtime = "nodejs";

const NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "SnapGrab";

/**
 * Dynamic Open Graph card: /api/og?title=…&subtitle=…&badge=…
 * Referenced from page metadata so every route gets a real social preview.
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const title = (p.get("title") ?? NAME).slice(0, 90);
  const subtitle = (p.get("subtitle") ?? "Download and convert media, free").slice(0, 130);
  const badge = (p.get("badge") ?? "Free · No signup").slice(0, 40);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #07060f 0%, #170f3a 55%, #0a2f38 100%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              background: "linear-gradient(135deg, #7048f0, #14c8be)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 800,
              color: "white",
            }}
          >
            {NAME.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ color: "white", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>{NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 20px",
              borderRadius: 999,
              background: "rgba(112,72,240,0.25)",
              border: "1px solid rgba(143,116,255,0.5)",
              color: "#b0a1ff",
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 26,
            }}
          >
            {badge}
          </div>
          <div style={{ color: "white", fontSize: 68, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2 }}>
            {title}
          </div>
          <div style={{ color: "#a9a3c4", fontSize: 30, marginTop: 22, lineHeight: 1.35 }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", color: "#6f6a8c", fontSize: 24 }}>
          <div>14 platforms · image tools · no watermark</div>
          <div>{(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "")}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
