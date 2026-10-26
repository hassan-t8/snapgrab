import type { Metadata } from "next";
import MenuViewer from "./MenuViewer";

/**
 * Public QR menu viewer. The menu itself is in the URL fragment (/m#…), which browsers never send
 * to the server, so this page is a static shell and MenuViewer decodes the menu on the device.
 */
export const metadata: Metadata = {
  title: "Menu",
  description: "View this restaurant's menu on your phone — made with the free QR Menu Maker on SnapGrab.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/m" },
};

export default function MenuPage() {
  return (
    <div className="px-4 pb-16 pt-4 sm:pt-8">
      <MenuViewer />
    </div>
  );
}
