import { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";

interface Props {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
  pulse: Animated.Value;
}

export function SkeletonBlock({ width, height, borderRadius = 6, style, pulse }: Props) {
  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: "#e5e7eb", opacity: pulse },
        style,
      ]}
    />
  );
}

export function usePulse() {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return pulse;
}
