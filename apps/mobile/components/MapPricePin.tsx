import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

type MapPricePinProps = {
  price: number;
  selected?: boolean;
  soldOut?: boolean;
};

export function MapPricePin({ price, selected = false, soldOut = false }: MapPricePinProps) {
  const priceText = soldOut ? "Sold out" : `€${price}`;
  const fill = soldOut ? "#F3F4F6" : selected ? "#111827" : "#FFFFFF";
  const stroke = soldOut ? "#9CA3AF" : "#111827";
  const textColor = soldOut ? "#6B7280" : selected ? "#FFFFFF" : "#111827";

  const dimensions = useMemo(() => {
    const textLength = priceText.length;
    const baseWidth = soldOut ? 58 : 46;
    const extraWidth = soldOut ? 0 : Math.max(0, (textLength - 3) * 7);
    const width = Math.max(baseWidth, baseWidth + extraWidth);
    const bubbleHeight = soldOut ? 20 : 26;
    const tailHeight = soldOut ? 4 : 6;
    const totalHeight = bubbleHeight + tailHeight;
    const tailWidth = soldOut ? 8 : 10;

    return { width, bubbleHeight, tailHeight, totalHeight, tailWidth };
  }, [priceText, soldOut]);

  const { width, bubbleHeight, tailHeight, totalHeight, tailWidth } = dimensions;
  const strokeWidth = 1;
  const radius = bubbleHeight / 2;
  const padding = strokeWidth;

  const pinPath = useMemo(() => {
    const w = width;
    const h = bubbleHeight;
    const r = radius;
    const tw = tailWidth / 2;
    const th = tailHeight;
    const cx = w / 2;
    const p = padding;

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

  const viewBoxWidth = width + padding * 2;
  const viewBoxHeight = totalHeight + padding * 2;

  return (
    <View style={[styles.container, { width: viewBoxWidth, height: viewBoxHeight }]}>
      <Svg width={viewBoxWidth} height={viewBoxHeight} viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
        <Path
          d={pinPath}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.9}
          strokeLinejoin="round"
        />
      </Svg>

      <View style={styles.textContainer} pointerEvents="none">
        <Text
          style={[
            styles.priceText,
            soldOut && styles.priceTextSoldOut,
            selected && !soldOut && styles.priceTextSelected,
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
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  textContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  priceText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  priceTextSelected: {
    color: "#FFFFFF",
  },
  priceTextSoldOut: {
    color: "#94A3B8",
    fontSize: 9,
  },
});
