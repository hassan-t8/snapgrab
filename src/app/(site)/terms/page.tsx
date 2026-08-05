import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using SnapGrab: what is allowed, what is not, and what we do and do not promise.",
  alternates: { canonical: "/terms" },
};

const BODY = `
## 1. Agreement

By using this website you agree to these terms. If you do not agree with them, please do not use the service.

## 2. What SnapGrab is

SnapGrab is a free tool that reads a publicly accessible media link, lists the download formats the source platform published, and proxies the file you choose to your device. It is a technical convenience — it does not grant you any rights over the content it retrieves.

## 3. Your responsibilities

You agree that you will:

- Only download content you created, content that is licensed for reuse, or content you have explicit permission to save.
- Not use the service to infringe copyright, trademark, privacy or publicity rights.
- Not attempt to access private, restricted or paywalled content.
- Not automate, scrape or otherwise place unreasonable load on the service.
- Not resell, rebrand or wrap the service in another product without written permission.

You are solely responsible for what you download and what you do with it afterwards.

## 4. What is not allowed

- Circumventing technical protection measures.
- Redistributing downloaded content commercially without the rights to do so.
- Using the service to harass, stalk or expose any individual.
- Any use that is unlawful where you live.

We may block access, without notice, where we believe these rules are being broken.

## 5. Availability

The service is provided "as is" and "as available". Platforms change their systems frequently; links that worked yesterday may fail today. We do not guarantee uptime, resolution success, download speed or the continued support of any particular platform.

## 6. Third-party content and services

Media is retrieved from third-party platforms and passed through a third-party resolution API. We do not host, own, control or endorse any of that content, and we are not affiliated with YouTube, Meta, TikTok, X, Pinterest, Reddit, Snapchat, LinkedIn, Vimeo, Dailymotion, SoundCloud or Twitch. All trademarks belong to their respective owners.

## 7. Advertising

The site is supported by advertising. Ad slots are clearly marked. We do not knowingly serve deceptive ads; if you see one, report it and we will remove the placement.

## 8. Limitation of liability

To the maximum extent permitted by law, we are not liable for any indirect, incidental or consequential damages, loss of data, or loss of profits arising from your use of the service. Where liability cannot be excluded, it is limited to the amount you paid us — which, for a free service, is zero.

## 9. Indemnity

You agree to indemnify us against claims arising from your misuse of the service or your infringement of anyone else's rights.

## 10. Copyright complaints

Rights holders should follow the process on our [DMCA page](/dmca). We act on valid notices promptly.

## 11. Changes to these terms

We may update these terms. The date at the top of the page reflects the latest revision, and continued use after a change constitutes acceptance.

## 12. Contact

**support@snapgrab.app**
`;

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="5 August 2026"
      intro="Short version: use it for content you have the right to keep, do not automate it, and do not expect guarantees from a free tool."
      body={BODY}
    />
  );
}
