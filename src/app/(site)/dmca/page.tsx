import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "DMCA & Copyright Policy",
  description: "How rights holders can submit a takedown notice to SnapGrab, and what happens after they do.",
  alternates: { canonical: "/dmca" },
};

const BODY = `
## Our position

SnapGrab does not host, store or index any media. The service reads a link you provide, asks the source platform which streams exist, and passes the file you select through to your browser. Nothing is retained on our servers.

Because of that, a takedown notice against SnapGrab cannot remove a file from us — there is no file. What we *can* do is block a specific URL or URL pattern from being processed by our tools, and we do that on receipt of a valid notice.

## Submitting a notice

Send the following to **dmca@snapgrab.app**:

1. A physical or electronic signature of the copyright owner, or a person authorised to act on their behalf.
2. Identification of the copyrighted work claimed to have been infringed.
3. The exact URL or URLs you are asking us to block.
4. Your name, address, telephone number and email address.
5. A statement that you have a good-faith belief that the use is not authorised by the copyright owner, its agent, or the law.
6. A statement, made under penalty of perjury, that the information in the notice is accurate and that you are the owner or authorised to act on the owner's behalf.

Incomplete notices will be returned rather than actioned, so please include every item.

## What happens next

- We acknowledge valid notices within two business days.
- Matching URLs are added to a block list and stop resolving on the site.
- We keep a record of the notice for our own compliance history.

## Counter-notice

If you believe a URL was blocked in error, send a counter-notice to the same address with your contact details, the URL concerned, and a statement under penalty of perjury that the block resulted from a mistake or misidentification. We will review it and restore access where the counter-notice is valid.

## Repeat infringers

We terminate access for users who repeatedly attempt to use the service to infringe copyright.

## A note to users

Downloading a video does not transfer any rights in it. Keeping a copy for personal, offline viewing is generally accepted; re-uploading it, monetising it or bundling it into your own product is not, and doing so exposes you — not us — to a claim.
`;

export default function DmcaPage() {
  return (
    <LegalPage
      title="DMCA & Copyright"
      updated="5 August 2026"
      intro="We host nothing, but we act on valid notices by blocking URLs from our tools. Here is exactly how to file one."
      body={BODY}
    />
  );
}
