import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.replit.dev", "*.sisko.replit.dev", "*.repl.co"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: "/help-&-support", destination: "/help-support", permanent: true },
      { source: "/help-%26-support", destination: "/help-support", permanent: true },
    ];
  },
};

export default nextConfig;
