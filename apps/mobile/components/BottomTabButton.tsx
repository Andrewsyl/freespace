import type { ReactNode } from "react";
import type { GestureResponderEvent } from "react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { radius } from "../styles/theme";

type Props = {
  children: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityState?: { selected?: boolean };
};

export function BottomTabButton({ children, onPress, accessibilityState }: Props) {
  return (
    <Pressable
      // Fire on touch-down, not release: the switch starts the moment the finger
      // lands, saving the press-out delay on every tab change.
      onPressIn={(e) => {
        onPress?.(e);
      }}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <View style={styles.item}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: "center",
    borderRadius: radius.pill,
    gap: 0,
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  pressable: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
