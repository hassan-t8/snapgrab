import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next blocks cross-origin requests to dev-only assets by default, which stops
  // React hydrating when you open the dev server from a phone on the LAN.
  // Only affects `next dev` — production builds are unaffected.
  allowedDevOrigins: ["192.168.1.41", "192.168.0.0/16", "10.0.0.0/8", "*.local"],
};

export default nextConfig;
