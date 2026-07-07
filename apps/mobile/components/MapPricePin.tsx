import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

type MapPricePinProps = {
  price: number;
  selected?: boolean;
  soldOut?: boolean;
};

// Soft-shadow margin around the pill. The shadow is painted inside the SVG
// (the marker ships as a captured bitmap, so RN shadow props can't reach it).
const SHADOW_MARGIN = 5;

// Pure geometry for a pin given its rendered label. Shared with MapSection so the
// captured-image markers can size their child <Image> to the exact pixel bounds
// (avoids the default red marker flash that the native `image` prop produces).
export function getPinDimensions(priceText: string, selected = false, soldOut = false) {
  const textLength = priceText.length;
  // 7px/char tracks PJS ExtraBold at ~12.5pt; clipping a price is worse than a
  // hair of slack.
  const charWidth = soldOut ? 5.6 : 7;
  const paddingH  = soldOut ? 9 : 11;
  const width     = Math.max(soldOut ? 36 : 44, textLength * charWidth + paddingH * 2);
  // Selected pill is a step larger — reads as "lifted" without animation.
  const pillHeight = soldOut ? 22 : selected ? 30 : 26;
  const viewBoxWidth  = width + SHADOW_MARGIN * 2;
  const viewBoxHeight = pillHeight + SHADOW_MARGIN * 2;
  return { width, pillHeight, viewBoxWidth, viewBoxHeight };
}

// Airbnb-class floating price pill: no tail, no outline doing the work — a
// tight stack of offset rounds fakes a blurred drop shadow (react-native-svg
// has no filter support we can trust inside ViewShot captures).
function MapPricePinBase({ price, selected = false, soldOut = false }: MapPricePinProps) {
  // "Full" over "Sold out": parking-native, and 4 characters fit the small
  // pill at a legible size where "Sold out" was an unreadable 9px.
  const priceText = soldOut ? "Full" : `€${price}`;

  // Unselected: pure white, ink price — the whitest, crispest objects on the
  // map. Selected: deep FreeSpace green owns the moment of choice.
  // Sold out: recedes — smaller, quieter, barely shadowed.
  const fill      = soldOut ? "#F7F8F9" : selected ? "#0A4230" : "#FFFFFF";
  const textColor = soldOut ? "#98A2AD" : selected ? "#FFFFFF" : "#111827";

  const { width, pillHeight, viewBoxWidth, viewBoxHeight } = useMemo(
    () => getPinDimensions(priceText, selected, soldOut),
    [priceText, soldOut, selected]
  );

  const m = SHADOW_MARGIN;
  const r = pillHeight / 2;
  // Three concentric passes, each a touch wider and lower — reads as one soft
  // shadow at device scale. Sold-out pills sit nearly flat on the map.
  const shadowLayers = soldOut
    ? [
        { grow: 1, drop: 1, opacity: 0.04 },
        { grow: 0, drop: 0.5, opacity: 0.06 },
      ]
    : [
        { grow: 3, drop: 2, opacity: selected ? 0.035 : 0.03 },
        { grow: 2, drop: 1.8, opacity: selected ? 0.045 : 0.04 },
        { grow: 1, drop: 1.4, opacity: selected ? 0.06 : 0.05 },
        { grow: 0, drop: 1, opacity: selected ? 0.09 : 0.08 },
      ];

  return (
    <View style={[styles.container, { width: viewBoxWidth, height: viewBoxHeight }]}>
      <Svg width={viewBoxWidth} height={viewBoxHeight} viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
        {shadowLayers.map((layer, index) => (
          <Rect
            key={index}
            x={m - layer.grow}
            y={m - layer.grow + layer.drop}
            width={width + layer.grow * 2}
            height={pillHeight + layer.grow * 2}
            rx={r + layer.grow}
            fill={`rgba(15,23,42,${layer.opacity})`}
          />
        ))}
        <Rect x={m} y={m} width={width} height={pillHeight} rx={r} fill={fill} />
        {/* Hairline keeps white pills defined over pale tiles without reading
            as a drawn border. */}
        {!selected ? (
          <Rect
            x={m + 0.5}
            y={m + 0.5}
            width={width - 1}
            height={pillHeight - 1}
            rx={r - 0.5}
            fill="none"
            stroke={soldOut ? "rgba(17,24,39,0.08)" : "rgba(17,24,39,0.10)"}
            strokeWidth={1}
          />
        ) : null}
      </Svg>

      <View style={styles.textContainer} pointerEvents="none">
        <Text
          style={[
            styles.priceText,
            selected && !soldOut && styles.priceTextSelected,
            soldOut && styles.priceTextSoldOut,
            { color: textColor },
          ]}
        >
          {priceText}
        </Text>
      </View>
    </View>
  );
}

// Pure and rendered once per captured pin variant — memo keeps it from
// re-rendering when the parent MapSection re-renders for unrelated reasons.
export const MapPricePin = memo(MapPricePinBase);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  textContainer: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  priceText: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 12.5,
    letterSpacing: -0.2,
  },
  priceTextSelected: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 13.5,
    letterSpacing: -0.3,
    lineHeight: 17,
  },
  priceTextSoldOut: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10.5,
    letterSpacing: 0,
  },
});
