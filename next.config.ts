import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aggressive Router prefetch cache: cached pages stay warm in client
  // for 10 minutes so back/forward + sibling navigation is instant.
  experimental: {
    staleTimes: {
      dynamic: 600,
      static: 600,
    },
  },
};

export default nextConfig;
