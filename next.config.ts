import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // cacheComponents: true, // Disabled to allow dynamic routes with uncached data
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Turbopack (dev): force single React so react-konva sees app React.
  turbopack: {
    resolveAlias: {
      // Use relative path from cwd; Turbopack may not accept absolute paths.
      react: "./node_modules/react",
      "react-dom": "./node_modules/react-dom",
    },
  },
  // Webpack (production build): force single React so react-konva sees app React (fixes ReactCurrentOwner).
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve(process.cwd(), "node_modules/react"),
      "react-dom": path.resolve(process.cwd(), "node_modules/react-dom"),
    };
    return config;
  },
};

export default nextConfig;
