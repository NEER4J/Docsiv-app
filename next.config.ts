import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents: true, // Disabled to allow dynamic routes with uncached data
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
