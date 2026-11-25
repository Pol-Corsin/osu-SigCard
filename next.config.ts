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
