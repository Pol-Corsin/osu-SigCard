import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Native rasterizer: load from node_modules at runtime instead of bundling.
  serverExternalPackages: ["@resvg/resvg-js", "sharp", "@electric-sql/pglite"],
  // The renderer reads fonts, flags and sample images from /public at runtime;
  // make sure they ship inside the serverless function bundle.
  outputFileTracingIncludes: {
    "/api/render": ["./public/fonts/card/**", "./public/flags/**", "./public/samples/**"],
    "/api/cards": ["./public/fonts/card/**", "./public/flags/**"],
    "/api/cards/**": ["./public/fonts/card/**", "./public/flags/**"],
    "/c/**": ["./public/fonts/card/**", "./public/flags/**"],
  },
  // Baseline hardening. Framing is denied everywhere: the studio and edit pages
  // hold the private edit token and its "reset link" action (clickjacking).
  // Card images are embedded with <img>, which these headers don't affect.
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
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
