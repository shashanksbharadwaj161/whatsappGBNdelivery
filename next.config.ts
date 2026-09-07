import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-only floating indicator sits over the driver view's
  // bottom action bar (a real mobile viewport, not just a dev
  // convenience) — never shipped to production regardless, but
  // distracting during local development too.
  devIndicators: false,
};

export default nextConfig;
