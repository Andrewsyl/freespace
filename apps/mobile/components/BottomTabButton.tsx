import { ReactNode, useEffect, useRef } from "react";
import type { GestureResponderEvent } from "react-native";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "../styles/theme";

type Props = {
  children: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityState?: { selected?: boolean };
};

export function BottomTabButton({ children, onPress, accessibilityState }: Props) {
  const focused = accessibilityState?.selected;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.8)).current;
  const bgOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.02 : 1,
        useNativeDriver: false,
        friction: 7,
        tension: 40,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0.8,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(bgOpacity, {
        toValue: focused ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused, scale, opacity, bgOpacity]);

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
            transform: [{ scale }],
            opacity,
            backgroundColor: bgOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["rgba(255,255,255,0)", colors.accentSoft],
            }),
            borderColor: bgOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["rgba(229,231,235,0)", "#CDEFE2"],
            }),
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
    borderWidth: 1,
    gap: 3,
    justifyContent: "center",
    minWidth: 84,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pressable: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
