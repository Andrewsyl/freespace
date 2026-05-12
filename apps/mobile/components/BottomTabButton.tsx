import { ReactNode, useEffect, useRef } from "react";
import type { GestureResponderEvent } from "react-native";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { radius } from "../styles/theme";

type Props = {
  children: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityState?: { selected?: boolean };
};

export function BottomTabButton({ children, onPress, accessibilityState }: Props) {
  const focused = accessibilityState?.selected;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  const lift = useRef(new Animated.Value(focused ? -0.5 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.01 : 1,
        useNativeDriver: false,
        friction: 7,
        tension: 40,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0.9,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(lift, {
        toValue: focused ? -0.5 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused, scale, opacity, lift]);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: false,
      friction: 8,
      tension: 200,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: focused ? 1.02 : 1,
      useNativeDriver: false,
      friction: 7,
      tension: 40,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
    >
      <Animated.View
        style={[
          styles.item,
          {
            transform: [{ scale }, { translateY: lift }],
            opacity,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: "center",
    borderRadius: radius.pill,
    gap: 1,
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  pressable: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
