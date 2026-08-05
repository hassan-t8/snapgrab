import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What SnapGrab collects, why we collect it, how long we keep it, who we share it with, and how to have it deleted.",
  alternates: { canonical: "/privacy" },
};

const BODY = `
## 1. Who we are

SnapGrab ("we", "us") operates this website and the download tools on it. This policy explains, in plain language, what happens to information about you when you use the site.

## 2. What we collect

**Automatically, on every visit**

- Your IP address
- Your browser user-agent string, and the browser, operating system and device type derived from it
- The page you are on and the page that referred you
- A random anonymous identifier stored in a cookie named \`sg_aid\`
- Approximate country and city, derived from your IP by our hosting provider

**When you use a downloader**

- The link you paste
- The platform it belongs to
- The format, quality and file type you chose
- Whether the request succeeded or failed, and the error if it failed

**When you contact us or subscribe**

- Your name, email address, subject and message
- Your email address only, for newsletter subscriptions

## 3. What we never collect

- The media file itself. Downloads stream from the source platform through our proxy to your device and are never written to our storage.
- Passwords or credentials for any social platform. We never ask for them, and you should never give them to any downloader site.
- Payment information. The site is free.

## 4. Why we collect it

- **To make the product work.** The link is needed to resolve it; the format is needed to serve it.
- **To keep it fast.** Resolved links are cached briefly so repeat requests are instant and use less upstream quota.
- **To prevent abuse.** IP-based rate limiting is how we stop automated scraping from degrading the service for everyone.
- **To understand usage.** Aggregate counts of visits, platforms and formats tell us what to build next.

## 5. Cookies

We use two cookies:

- \`sg_aid\` — a random anonymous identifier, valid for one year, used to group your page views into a single visit history.
- \`sg_admin\` — set only for site administrators after logging into the dashboard. Ordinary visitors never receive it.

Advertising partners may set their own cookies. See section 8.

## 6. How long we keep things

- Cached resolve results: about one hour.
- Visitor, page view and download rows: retained on a rolling basis for analytics, and pruned periodically.
- Contact messages: kept until handled, then deleted from the dashboard.

## 7. Who we share with

- **Our media provider.** The link you paste is sent to a third-party API (accessed through RapidAPI) which returns the available streams. Only the link is sent — never your IP or identifiers.
- **Our hosting provider,** which necessarily processes request logs.
- **Advertising partners,** as described below.

We do not sell personal information.

## 8. Advertising

This site may display ads served by Google AdSense and its partners. Google may use cookies or device identifiers to serve ads based on your prior visits to this and other websites. You can opt out of personalised advertising in [Google Ads Settings](https://www.google.com/settings/ads), and manage third-party cookies at [aboutads.info](https://www.aboutads.info/choices/).

## 9. Your rights

Depending on where you live, you may have the right to access, correct, export or delete the data we hold about you, and to object to certain processing. Email us and we will act on the request. Because our records are tied to an anonymous cookie id and an IP address rather than a name, we may ask for the approximate date and IP you used so we can find the right rows.

To reset your identifier at any time, clear the \`sg_aid\` cookie in your browser settings.

## 10. Children

The service is not directed at children under 13, and we do not knowingly collect information from them.

## 11. Changes

If this policy changes materially, we will update the date at the top of the page. Continued use of the site after a change means you accept the revised policy.

## 12. Contact

Questions about this policy: **support@snapgrab.app**
`;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="5 August 2026"
      intro="No dark patterns and no fog. Here is exactly what we record, why, and how to make us delete it."
      body={BODY}
    />
  );
}
