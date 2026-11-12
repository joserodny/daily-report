import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/**/*": ["./public/signature-logos.png"] },
};

export default nextConfig;
