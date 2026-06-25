import type { MetadataRoute } from "next";

// Pre-launch: keep the whole site out of search indexes until we go live.
// At launch, change this to allow crawling (and re-add the sitemap reference).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
