import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";

// Vertical "roll" transition for values that swap in place. When `swapKey`
// changes, the outgoing content rolls up and out of view while the incoming
// content rolls in from below — an odometer / drum-roll feel (matches the
// DrumRollPicker language). Content changes that DON'T change swapKey update
// live with no animation, so editing a time doesn't trigger a roll — only the
// hourly⇄monthly swap does.
export function RollingSwap({
  swapKey,
  children,
  style,
  duration = 300,
}: {
  swapKey: string | number;
  children: ReactNode;
  style?: ViewStyle;
  duration?: number;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  const prevChildren = useRef<ReactNode>(children);
  const firstRun = useRef(true);
  const [ghost, setGhost] = useState<ReactNode>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    // Snapshot the outgoing content into the ghost layer, then roll.
    setGhost(prevChildren.current);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setGhost(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapKey]);

  // Keep the latest rendered children so the next swap can snapshot them.
  useEffect(() => {
    prevChildren.current = children;
  });

  const rolling = height > 0 && ghost != null;

  return (
    <View style={[styles.clip, style]}>
      {/* Incoming (live) layer — rolls up from below into place. */}
      <Animated.View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - height) > 1) setHeight(h);
        }}
        style={
          rolling
            ? {
                opacity: anim,
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [height, 0],
                    }),
                  },
                ],
              }
            : null
        }
      >
        {children}
      </Animated.View>

      {/* Outgoing (ghost) layer — rolls up and out of view. */}
      {rolling ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -height],
                  }),
                },
              ],
            },
          ]}
        >
          {ghost}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
});
