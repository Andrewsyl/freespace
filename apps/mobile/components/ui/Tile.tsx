import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../../styles/theme";

/**
 * The bordered white box that holds grouped content on the ground.
 *
 * One geometry, everywhere: 1px `divider` edge, radius 8, 16 padding, 16
 * inset from the screen. A section header never lives inside one of these —
 * headers sit on the ground above, see `<Section>`.
 *
 * Radius 8, not 12: at 12 the corner arc is wide enough to soften the edge
 * into the ground and the box stops reading as a crisp sheet. The tighter
 * corner is what makes the border look drawn rather than faded.
 *
 * `flush` drops the padding for tiles whose children own their own insets
 * (split controls, rails, anything that needs to reach the tile's edge).
 */
export function Tile({
  children,
  flush = false,
  rows = false,
  style,
}: {
  children: React.ReactNode;
  flush?: boolean;
  /**
   * For a tile holding a list of rows that supply their own 6px vertical
   * rhythm. Trims the tile's own vertical padding so the first row still
   * clears the edge by the system's 16 — 10 here plus the row's 6 — instead
   * of stacking two paddings into 22.
   */
  rows?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.tile, flush && styles.flush, rows && styles.rows, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.appBg,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  // overflow hidden so a child's own background respects the radius.
  flush: { padding: 0, overflow: "hidden" },
  rows: { paddingVertical: 10 },
});
