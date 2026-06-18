import type { MetadataRoute } from "next";
import { LEGAL_DOCS } from "../lib/legal-content";
import { webEnv } from "../lib/env";

const siteUrl = "https://www.freespace.ie";
const searchCenters = [
  { lat: 53.3498, lng: -6.2603 }, // Dublin
  { lat: 51.8985, lng: -8.4756 }, // Cork
  { lat: 53.2707, lng: -9.0568 }, // Galway
  { lat: 52.6638, lng: -8.6267 }, // Limerick
] as const;

function entry(
  path: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}${path}`,
    priority,
    changeFrequency,
  };
}

async function getListingEntries(): Promise<MetadataRoute.Sitemap> {
  const apiBase = webEnv.NEXT_PUBLIC_API_BASE;
  const from = new Date();
  const to = new Date(from.getTime() + 2 * 60 * 60 * 1000);
  const settled = await Promise.allSettled(
    searchCenters.map(async ({ lat, lng }) => {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radiusKm: "50",
        from: from.toISOString(),
        to: to.toISOString(),
        includeUnavailable: "true",
      });
      const res = await fetch(`${apiBase}/api/listings/search?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return [] as string[];
      const body = (await res.json().catch(() => null)) as { spaces?: Array<{ id?: string }> } | null;
      return body?.spaces?.map((space) => space.id).filter((id): id is string => Boolean(id)) ?? [];
    })
  );

  const ids = new Set<string>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const id of result.value) ids.add(id);
  }

  return [...ids].map((id) => entry(`/listing/${id}`, 0.6, "weekly"));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listingEntries = await getListingEntries();

  return [
    entry("/", 1, "daily"),
    entry("/search", 0.8, "daily"),
    entry("/contact", 0.8, "monthly"),
    entry("/legal", 0.8, "monthly"),
    ...LEGAL_DOCS.map((doc) => entry(`/legal/${doc.slug}`, 0.6, "monthly")),
    ...listingEntries,
  ];
}
