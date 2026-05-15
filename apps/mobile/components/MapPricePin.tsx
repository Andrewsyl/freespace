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
  const fill = soldOut ? "#F4F5F6" : selected ? "#147A72" : "#FFFFFF";
  const stroke = soldOut ? "#D7DDE2" : selected ? "#0F625C" : "#1E293B";
  const textColor = soldOut ? "#7A8493" : selected ? "#FFFFFF" : "#0F172A";

  const dimensions = useMemo(() => {
    const textLength = priceText.length;
    const baseWidth = soldOut ? 52 : 44;
    const extraWidth = soldOut ? 0 : Math.max(0, (textLength - 3) * 6);
    const width = Math.max(baseWidth, baseWidth + extraWidth);
    const bubbleHeight = soldOut ? 18 : 24;
    const tailHeight = soldOut ? 4 : 5;
    const totalHeight = bubbleHeight + tailHeight;
    const tailWidth = soldOut ? 7 : 8;

    return { width, bubbleHeight, tailHeight, totalHeight, tailWidth };
  }, [priceText, soldOut]);

  const { width, bubbleHeight, tailHeight, totalHeight, tailWidth } = dimensions;
  const strokeWidth = soldOut ? 1 : 1.35;
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
  const shadowCx = viewBoxWidth / 2;
  const shadowCy = viewBoxHeight - 2;

  return (
    <View style={[styles.container, { width: viewBoxWidth, height: viewBoxHeight }]}>
      <Svg width={viewBoxWidth} height={viewBoxHeight} viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
        <Ellipse
          cx={shadowCx}
          cy={shadowCy}
          rx={Math.max(7, width * 0.16)}
          ry={2.3}
          fill="rgba(15, 23, 42, 0.12)"
        />
        <Path
          d={pinPath}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
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
  },
  textContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  priceText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.15,
    fontFamily: "PlusJakartaSans-Bold",
  },
  priceTextSelected: {
    color: "#FFFFFF",
  },
  priceTextSoldOut: {
    color: "#7A8493",
    fontSize: 8,
  },
});
