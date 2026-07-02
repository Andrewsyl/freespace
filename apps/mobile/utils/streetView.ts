// Prefers the panorama ID the host actually navigated to (e.g. by moving down
// the road) over the listing's raw address coordinates — a `location=lat,lng`
// query always resolves to the panorama nearest that address, discarding any
// movement away from it.
export function buildStreetViewImageUrl({
  coverPanoId,
  coverHeading,
  coverPitch,
  latitude,
  longitude,
  mapsKey,
}: {
  coverPanoId?: string | null;
  coverHeading?: number | null;
  coverPitch?: number | null;
  latitude: number;
  longitude: number;
  mapsKey: string;
}): string | null {
  if (coverHeading == null || !mapsKey) return null;
  const locationParam = coverPanoId
    ? `pano=${encodeURIComponent(coverPanoId)}`
    : `location=${latitude},${longitude}`;
  return `https://maps.googleapis.com/maps/api/streetview?size=1280x720&${locationParam}&heading=${coverHeading}&pitch=${coverPitch ?? 0}&fov=80&source=outdoor&key=${mapsKey}`;
}
