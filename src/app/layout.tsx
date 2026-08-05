import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "SnapGrab";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: `${NAME} — Download Video from YouTube, Instagram, Facebook & TikTok`,
    template: `%s · ${NAME}`,
  },
  description:
    "Paste any link and download the video, reel, story or audio in seconds. Supports YouTube, Instagram, Facebook, TikTok, X, Pinterest, Reddit and more. Free, no signup, no watermark.",
  keywords: [
    "video downloader",
    "youtube downloader",
    "instagram reels downloader",
    "facebook video downloader",
    "tiktok downloader no watermark",
    "twitter video download",
    "mp4 downloader",
    "youtube to mp3",
  ],
  openGraph: {
    type: "website",
    siteName: NAME,
    url: SITE,
    title: `${NAME} — All-in-one social video downloader`,
    description: "Paste a link, get the file. YouTube, Instagram, Facebook, TikTok and 10 more platforms.",
    locale: "en_US",
    images: [
      {
        url: `${SITE}/api/og?title=${encodeURIComponent("Download any video. Just paste the link.")}&subtitle=${encodeURIComponent("14 platforms · image tools · no signup")}`,
        width: 1200,
        height: 630,
        alt: NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${NAME} — All-in-one social video downloader`,
    description: "Paste a link, get the file. Free, fast, no watermark.",
    images: [`${SITE}/api/og?title=${encodeURIComponent("Download any video")}`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  alternates: { canonical: "/" },
  applicationName: NAME,
  category: "technology",
  creator: NAME,
  publisher: NAME,
  formatDetection: { telephone: false },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07060f" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
};

// runs before paint so the theme never flashes
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('sg-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  const adsense = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  return (
    <html lang="en" className={`${jakarta.variable} dark h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {adsense ? (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
