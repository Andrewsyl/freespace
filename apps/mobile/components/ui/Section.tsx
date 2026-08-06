import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, textStyles } from "../../styles/theme";

/**
 * A section header on the ground: title, optional sub-line, optional green
 * action on the right.
 *
 * This sits *above* a tile, never inside one — putting the header in the box
 * is what made sections read as unrelated cards rather than one page.
 */
export function Section({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
            <Text style={textStyles.dsAction}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  // flex/shrink rather than marginLeft:auto — a long title otherwise runs
  // straight into the action and the two overlap on a narrow screen.
  title: { ...textStyles.dsSection, flex: 1, minWidth: 0 },
  subtitle: { ...textStyles.dsBody, color: colors.textTertiary, marginTop: 2 },
});
