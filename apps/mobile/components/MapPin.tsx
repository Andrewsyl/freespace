import { StyleSheet, Text, View } from "react-native";

export function MapPin({
  label,
  selected = false,
  onLayout,
}: {
  label?: string;
  selected?: boolean;
  onLayout?: () => void;
}) {
  return (
    <View style={styles.container} pointerEvents="box-none" onLayout={onLayout}>
      <View style={styles.hitArea} pointerEvents="none" />
      <View style={styles.pinWrapper} pointerEvents="none">
        <View
          style={[
            styles.pinCircle,
            selected && styles.pinCircleActive,
            selected && styles.pinCircleSelected,
          ]}
        >
          {label ? (
            <Text style={[styles.pinLabel, selected && styles.pinLabelActive]}>{label}</Text>
          ) : null}
        </View>
        <View style={[styles.pinTail, selected && styles.pinTailActive]} />
        <View style={styles.pinShadow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    position: "relative",
  },
  hitArea: {
    height: 48,
    left: -9,
    position: "absolute",
    top: -9,
    width: 48,
  },
  pinWrapper: {
    alignItems: "center",
  },
  pinCircle: {
    alignItems: "center",
    backgroundColor: "#ff385c",
    borderRadius: 13,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  pinCircleActive: {
    backgroundColor: "#0f172a",
  },
  pinCircleSelected: {
    transform: [{ scale: 1.05 }],
  },
  pinLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  pinLabelActive: {
    color: "#ffffff",
  },
  pinTail: {
    borderLeftColor: "transparent",
    borderLeftWidth: 6,
    borderRightColor: "transparent",
    borderRightWidth: 6,
    borderTopColor: "#ff385c",
    borderTopWidth: 8,
    height: 0,
    marginTop: -2,
    width: 0,
  },
  pinTailActive: {
    borderTopColor: "#0f172a",
  },
  pinShadow: {
    backgroundColor: "rgba(15, 23, 42, 0.18)",
    borderRadius: 999,
    height: 4,
    marginTop: -2,
    width: 12,
  },
});
