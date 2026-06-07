import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";

type MapPricePinProps = {
  price: number;
  selected?: boolean;
  soldOut?: boolean;
};

export function MapPricePin({ price, selected = false, soldOut = false }: MapPricePinProps) {
  const priceText = soldOut ? "Sold out" : `€${price}`;

  // Unselected: white pill, whisper-grey border — shadow does the heavy lifting
  // Selected: charcoal fill, white text, slightly taller bubble for visual prominence
  const fill      = soldOut ? "#F4F5F6" : selected ? "#111827" : "#FFFFFF";
  const stroke    = soldOut ? "#D7DDE2" : selected ? "#111827" : "#C6CDD6";
  const textColor = soldOut ? "#7A8493" : selected ? "#FFFFFF"  : "#111827";

  const dimensions = useMemo(() => {
    const textLength = priceText.length;
    const baseWidth   = soldOut ? 52 : 46;
    const extraWidth  = soldOut ? 0  : Math.max(0, (textLength - 3) * 6.5);
    const width       = Math.max(baseWidth, baseWidth + extraWidth);
    // Selected bubble is taller — gives the "scale up on select" feel without animation
    const bubbleHeight = soldOut ? 18 : selected ? 28 : 24;
    const tailHeight   = soldOut ? 4  : selected ? 6  : 5;
    const totalHeight  = bubbleHeight + tailHeight;
    const tailWidth    = soldOut ? 7  : 9;
    return { width, bubbleHeight, tailHeight, totalHeight, tailWidth };
  }, [priceText, soldOut, selected]);

  const { width, bubbleHeight, tailHeight, totalHeight, tailWidth } = dimensions;
  const strokeWidth = soldOut ? 0.85 : selected ? 1.2 : 0.85;
  const radius  = bubbleHeight / 2;
  const padding = strokeWidth;

  const pinPath = useMemo(() => {
    const w  = width;
    const h  = bubbleHeight;
    const r  = radius;
    const tw = tailWidth / 2;
    const th = tailHeight;
    const cx = w / 2;
    const p  = padding;
    return `
      M ${r + p} ${p}
      L ${w - r + p} ${p}
      A ${r} ${r} 0 0 1 ${w + p} ${r + p}
      A ${r} ${r} 0 0 1 ${w - r + p} ${h + p}
      L ${cx + tw + p} ${h + p}
      L ${cx + p} ${h + th + p}
      L ${cx - tw + p} ${h + p}
      L ${r + p} ${h + p}
      A ${r} ${r} 0 0 1 ${p} ${r + p}
      A ${r} ${r} 0 0 1 ${r + p} ${p}
      Z
    `.trim();
  }, [width, bubbleHeight, tailHeight, tailWidth, radius, padding]);

  const viewBoxWidth  = width + padding * 2;
  const viewBoxHeight = totalHeight + padding * 2;
  const shadowCx = viewBoxWidth / 2;
  const shadowCy = viewBoxHeight - 1.5;

  // Shadow: two-layer ellipse gives a soft, natural drop
  const shadowRx = Math.max(12, width * 0.28);

  return (
    <View style={[styles.container, { width: viewBoxWidth, height: viewBoxHeight }]}>
      <Svg width={viewBoxWidth} height={viewBoxHeight} viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
        {/* Outer soft glow */}
        <Ellipse cx={shadowCx} cy={shadowCy} rx={shadowRx + 4} ry={3.8} fill="rgba(15,23,42,0.06)" />
        {/* Crisp ground shadow */}
        <Ellipse cx={shadowCx} cy={shadowCy} rx={shadowRx} ry={2.6} fill="rgba(15,23,42,0.16)" />
        <Path
          d={pinPath}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </Svg>

      <View style={[styles.textContainer, { paddingBottom: tailHeight }]} pointerEvents="none">
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
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: -0.2,
  },
  priceTextSelected: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    letterSpacing: -0.3,
    lineHeight: 16,
  },
  priceTextSoldOut: {
    fontSize: 8,
  },
});
