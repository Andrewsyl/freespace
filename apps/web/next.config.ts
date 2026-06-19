import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Listing photos uploaded via S3 presigned post
      { protocol: "https", hostname: "**.amazonaws.com" },
      // Google Street View Static API (listing card fallback images)
      { protocol: "https", hostname: "maps.googleapis.com" },
      // Unsplash fallback images
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  async headers() {
    return [
      // Long-term immutable caching for Next.js hashed static chunks
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Short-term caching for public images and icons (1 week)
      {
        source: "/(favicon.*|icon-.*\\.png|apple-touch-icon\\.png|site\\.webmanifest)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      // Apple / Android app-link files
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default config;
