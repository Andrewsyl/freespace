// Normal, natural-looking light map: Google's default colours with just a
// slight lift, quieter labels, and icon/POI noise removed. Do not add
// atmosphere/desaturation passes here — flat or tinted basemaps read dull.
export const LIGHT_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ lightness: 10 }, { saturation: 0 }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#2f3a45" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#d7dde2" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#5f6b76" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
];
