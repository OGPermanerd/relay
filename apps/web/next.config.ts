import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@relay/ui", "@relay/core", "@relay/db"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
