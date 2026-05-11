import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Streaming-Antworten von Anthropic erlauben
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
