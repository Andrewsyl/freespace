import { StyleSheet, Text, View } from "react-native";
import { radius } from "../../styles/theme";
import { hostFlowColors } from "./hostFlowTheme";

type Props = {
  current: number;
  total: number;
};

export function StepProgress({ current, total }: Props) {
  const safeTotal = total > 0 ? total : 1;
  const progress = Math.min(Math.max(current / safeTotal, 0), 1);
  const percent = Math.round(progress * 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>Step {current} of {total}</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: hostFlowColors.textSoft,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  percent: {
    color: hostFlowColors.textMuted,
    fontSize: 13,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
  },
  bar: {
    backgroundColor: hostFlowColors.border,
    borderRadius: radius.pill,
    height: 6,
    marginTop: 10,
    overflow: "hidden",
  },
  barFill: {
    backgroundColor: hostFlowColors.accent,
    borderRadius: radius.pill,
    height: "100%",
  },
});
