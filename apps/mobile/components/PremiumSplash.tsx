import { useEffect } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * PremiumSplash — "Ascend"
 *
 * A confident, minimal launch. The bare logo mark (white "FREE" wordmark + green U,
 * transparent) rises 96% -> 100% and fades in over a dark green-black surface with a
 * radial glow + vignette for depth. The glow behind the mark breathes gently as an
 * almost-invisible loading indicator, then the whole layer fades to the app.
 *
 * Everything animates on transform/opacity via Reanimated worklets (UI thread), so it
 * holds 60fps on iOS and Android. Full-bleed by design so the launch reads edge to edge.
 */

const MARK = require("../assets/white/png/logo-mark-light.png");

// Timing (ms) — total ~1.7s, inside the 1.2–2s brief.
const ENTER_DELAY = 60;
const EXIT_AT = 1360;
const EXIT_DURATION = 360;

type Props = {
  onFinish?: () => void;
};

export function PremiumSplash({ onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const markSize = Math.min(width * 0.52, 230);
  const glowSize = markSize * 2;

  const root = useSharedValue(1); // whole-layer opacity (fade out at the end)
  const mark = useSharedValue(0); // mark entrance 0 -> 1
  const glow = useSharedValue(0); // glow entrance then breathing loop

  useEffect(() => {
    mark.value = withDelay(
      ENTER_DELAY,
      withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) })
    );

    glow.value = withDelay(
      120,
      withSequence(
        withTiming(1, { duration: 640, easing: Easing.out(Easing.quad) }),
        // breathing loop — the invisible loader
        withRepeat(
          withSequence(
            withTiming(0.72, { duration: 950, easing: Easing.inOut(Easing.quad) }),
            withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) })
          ),
          -1,
          false
        )
      )
    );

    root.value = withDelay(
      EXIT_AT,
      withTiming(0, { duration: EXIT_DURATION, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished && onFinish) runOnJS(onFinish)();
      })
    );
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mark.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(mark.value, [0, 1], [0.96, 1]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 0.9]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.92, 1.08]) }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, rootStyle]}
      pointerEvents="none"
    >
      {/* Very subtle vertical gradient over the base dark surface */}
      <LinearGradient
        colors={["#0E1512", "#0A0F0D", "#070B09"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Vignette for depth (static SVG radial) */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="46%" r="75%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="70%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.55} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
      </Svg>

      <View style={styles.center}>
        {/* Breathing ambient glow behind the mark */}
        <Animated.View
          style={[
            styles.glow,
            { width: glowSize, height: glowSize, borderRadius: glowSize / 2 },
            glowStyle,
          ]}
        >
          <Svg width={glowSize} height={glowSize}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#0a8050" stopOpacity={0.42} />
                <Stop offset="45%" stopColor="#0a8050" stopOpacity={0.14} />
                <Stop offset="100%" stopColor="#0a8050" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={glowSize} height={glowSize} fill="url(#glow)" />
          </Svg>
        </Animated.View>

        {/* Hero: the bare logo mark (white wordmark + green U, transparent) */}
        <Animated.View style={markStyle}>
          <Image
            source={MARK}
            style={{ width: markSize, height: markSize }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0A0F0D",
    // Must sit above the auth "Signing in..." LoadingOverlay (zIndex 9999), which
    // otherwise flattens into a sibling of this splash and paints its spinner on top.
    zIndex: 10000,
    elevation: 10000,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
