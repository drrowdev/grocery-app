import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep prefetched pages warm in the client briefly so list-rail switches
  // feel instant, but short enough that mutations on one list show up when
  // you flip between lists. 30s is the Next 15+ default for `dynamic`.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
