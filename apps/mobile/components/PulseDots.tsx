import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

/**
 * Branded three-dot pulse loader. Replaces the platform ActivityIndicator in
 * chrome — the OS spinner (Material on Android) inside our pills is the
 * fastest way to look like a stock React Native app.
 */
export function PulseDots({ color = "#0a8050", size = 5 }: { color?: string; size?: number }) {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    const loops = anims.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(value, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.35, duration: 260, useNativeDriver: true }),
          Animated.delay((2 - index) * 140),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [anims]);

  return (
    <View style={styles.row}>
      {anims.map((value, index) => (
        <Animated.View
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: value,
            transform: [
              {
                scale: value.interpolate({
                  inputRange: [0.35, 1],
                  outputRange: [0.9, 1.15],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 4 },
});
