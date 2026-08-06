import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { colors, textStyles } from "../../styles/theme";

/**
 * A single fact about the thing on screen: one icon, one line, optionally a
 * chevron when the row leads somewhere.
 *
 * Rows do not rule themselves off from each other — the 34px height and the
 * fixed icon column supply the rhythm. Adding hairlines between these is what
 * made the pre-2a screens read as a stack of boxes.
 *
 * The line holds roughly 30 characters at 390px. Anything longer belongs in
 * `meta` or in a tile, not wrapped onto a second line here.
 */
export function FactRow({
  icon: Icon,
  children,
  meta,
  onPress,
  iconColor = colors.iconGrey,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  children: string;
  meta?: string;
  onPress?: () => void;
  /** Overrides the gutter grey — used only where the glyph carries meaning. */
  iconColor?: string;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      <View style={styles.icon}>
        <Icon size={24} color={iconColor} strokeWidth={1.6} />
      </View>
      <View style={styles.copy}>
        <Text style={textStyles.dsFact} numberOfLines={1}>
          {children}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {onPress ? (
        <ChevronRight size={18} color={colors.primary} strokeWidth={2.2} />
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    minHeight: 34,
    paddingVertical: 5,
  },
  // Fixed width so every row's text starts on the same vertical line whatever
  // glyph sits beside it.
  icon: { width: 24, flexShrink: 0, alignItems: "center" },
  copy: { flex: 1, minWidth: 0 },
  meta: { ...textStyles.dsMeta, marginTop: 2 },
});
