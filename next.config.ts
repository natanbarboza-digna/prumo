import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // A self-contained server for the Docker image (plan 014). Only when the
  // Dockerfile asks for it: `next start`, used by the e2e tests, does not work
  // with standalone output (plan 018).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  cacheComponents: true,
  experimental: {
    serverActions: {
      // The PDI import (plan 013) accepts spreadsheets up to 1 MB; the default
      // 1 MB limit counts the whole request, form fields included.
      bodySizeLimit: "2mb",
    },
  },
  partialPrefetching: true,
  // Security headers on every response (plan 039), with or without Caddy in
  // front. HSTS stays in the Caddyfile: it only makes sense over HTTPS.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
