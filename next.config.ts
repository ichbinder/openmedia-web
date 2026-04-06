import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/**",
      },
    ],
  },
  // NOTE: No rewrites for /api/backend/* — the Route Handler in
  // src/app/api/backend/[...path]/route.ts handles proxying to Express
  // and manages httpOnly cookies for auth. A rewrite would bypass it.
};

export default nextConfig;
