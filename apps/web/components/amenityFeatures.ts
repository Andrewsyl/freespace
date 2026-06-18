export type FeatureKey = "covered" | "gated" | "cctv" | "ev";

function toLowerList(values?: string[] | null) {
  return [...(values ?? [])].map((value) => value.toLowerCase());
}

function hasFeature(features: string[], needle: string) {
  return features.some((feature) => feature.includes(needle));
}

export function deriveFeatureKeys(amenities?: string[] | null, title?: string): FeatureKey[] {
  const features = toLowerList(amenities);
  const titleText = title?.toLowerCase() ?? "";
  const out: FeatureKey[] = [];

  if (hasFeature(features, "cover") || hasFeature(features, "shelter") || hasFeature(features, "roof") ||
      titleText.includes("garage") || titleText.includes("underground") || titleText.includes("indoor") || titleText.includes("covered")) {
    out.push("covered");
  }
  if (hasFeature(features, "gat") || hasFeature(features, "barrier")) out.push("gated");
  if (hasFeature(features, "cctv") || hasFeature(features, "camera")) out.push("cctv");
  if (hasFeature(features, "ev") || hasFeature(features, "charg")) out.push("ev");

  return [...new Set(out)];
}
