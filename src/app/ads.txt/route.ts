import { getIntegration } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/** ads.txt for AdSense, generated from the publisher ID saved in Admin → Integrations. */
export async function GET() {
  const client = await getIntegration("NEXT_PUBLIC_ADSENSE_CLIENT");
  const pub = client?.replace(/^ca-/, "");
  if (!pub || !/^pub-\d{10,20}$/.test(pub)) {
    return new Response("# AdSense publisher ID not set yet\n", { status: 404, headers: { "content-type": "text/plain" } });
  }
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "content-type": "text/plain", "cache-control": "public, max-age=3600" },
  });
}
