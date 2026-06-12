import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    outputFileTracingIncludes: {
      "/api/brand-expert/pdf": ["./node_modules/pdfkit/js/data/**/*"],
    },
  },
};

export default nextConfig;
