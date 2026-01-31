import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@relay/ui", "@relay/core", "@relay/db"],
};

export default nextConfig;
