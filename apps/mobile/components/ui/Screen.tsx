import { ScrollView, ScrollViewProps, StyleSheet, View, ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, surfaces } from "../../styles/theme";

type ScreenProps = ViewProps & {
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
  /**
   * Opt into the two-surface model: the screen sits on the ground tint and
   * drops the default horizontal inset, because tiles and section headers
   * carry their own 16. A `<Masthead>` supplies the white surface on top.
   *
   * Off by default so screens not yet converted keep their current padding —
   * a half-converted screen reads worse than an unconverted one.
   */
  ground?: boolean;
};

export function Screen({
  children,
  style,
  scroll = false,
  scrollProps,
  ground = false,
  ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const base = ground ? styles.ground : styles.screen;

  if (scroll) {
    return (
      <ScrollView
        {...scrollProps}
        style={[base, style]}
        contentContainerStyle={[
          ground ? styles.groundContent : styles.scrollContent,
          scrollProps?.contentContainerStyle,
          { paddingBottom: spacing.xl + Math.max(insets.bottom, spacing.md) },
        ]}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View {...props} style={[base, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...surfaces.screen,
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenY,
    paddingBottom: spacing.xl,
  },
  ground: { flex: 1, backgroundColor: colors.ground },
  // No horizontal inset: tiles and section headers own their own 16, so the
  // ground can run full-bleed behind rails that need to reach the edge.
  groundContent: { paddingBottom: spacing.xl },
});
