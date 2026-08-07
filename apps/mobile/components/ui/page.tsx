/**
 * The page kit — the shared shapes behind the listing and booking-review
 * screens.
 *
 * Every component here was extracted from code that already existed in both
 * pages; nothing is speculative. The caller count is in each doc comment so a
 * later reader can see what the evidence was.
 *
 * Reads the `page*` tokens from `styles/theme.ts` via `styles/pageTokens`.
 * Those are a colder, higher-contrast set than the older tokens the rest of
 * the app uses — don't mix the two within one screen.
 */
import { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { GREEN, INK, MUTED, PILL, RULE, WHITE } from "../../styles/pageTokens";

/** The page's horizontal inset. Everything in the kit sits on it. */
export const GUTTER = 24;

// ── Type ────────────────────────────────────────────────────────────────────
// Six steps, which is all the two pages actually use.
export const text = StyleSheet.create({
  /** Screen title — the review page's "Review and continue". */
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 32, lineHeight: 38, letterSpacing: -0.9, color: INK,
  },
  /** Masthead title — the listing's space name. */
  display: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 26, lineHeight: 31, letterSpacing: -0.6, color: INK,
  },
  /** Section heading. */
  section: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 19, lineHeight: 24, letterSpacing: -0.3, color: INK,
  },
  /** A row's value, and the label above it at Bold. */
  row: { fontFamily: "PlusJakartaSans-Regular", fontSize: 17, lineHeight: 24, color: INK },
  /** List labels and prose. */
  body: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: INK },
  /** Supporting and muted copy. */
  meta: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },
});

/**
 * The inset hairline that does all the separating. the listing has no cards and no
 * borders — this is the only divider. (5 callers.)
 */
export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.rule, style]} />;
}

/**
 * Section heading with its own padding, optionally carrying an action on the
 * right. (4 callers.)
 */
export function SectionTitle({
  children,
  actionLabel,
  onAction,
}: {
  children: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionBlock}>
      {/* flex/shrink rather than marginLeft:auto on the action — with auto a
          long title runs straight into it and the two touch. */}
      <Text style={[text.section, styles.sectionTitle]}>{children}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The one button shape: a full-width grey pill under a list. (2 callers.) */
export function PillButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.pill} onPress={onPress} accessibilityRole="button">
      <Text style={styles.pillLabel}>{label}</Text>
    </Pressable>
  );
}

/** The one list shape: 20px outline icon, 16 gap, 15px label. (mapped.) */
export function ListRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listIcon}>
        <Icon size={20} color={INK} strokeWidth={1.7} />
      </View>
      <Text style={[text.body, styles.listLabel]}>{label}</Text>
    </View>
  );
}

/**
 * Same geometry as ListRow but with stacked copy and an optional chevron —
 * the "Things to know" shape. (3 callers.)
 */
export function FactRow({
  icon: Icon,
  title,
  lines,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  lines: string[];
  onPress?: () => void;
}) {
  const Container = onPress ? Pressable : View;
  return (
    <Container style={styles.factRow} onPress={onPress}>
      <View style={[styles.listIcon, styles.factIcon]}>
        <Icon size={20} color={INK} strokeWidth={1.7} />
      </View>
      <View style={styles.factCopy}>
        <Text style={styles.factTitle}>{title}</Text>
        {lines.map((line) => (
          <Text key={line} style={styles.factLine}>
            {line}
          </Text>
        ))}
      </View>
      {onPress ? (
        <ChevronRight size={18} color={INK} strokeWidth={1.8} style={styles.factChevron} />
      ) : null}
    </Container>
  );
}

/**
 * Label, value, an optional grey action, and an optional full-width footer.
 * The review page's row. (5 callers.)
 */
export function ReviewRow({
  label,
  children,
  actionLabel,
  onAction,
  footer,
}: {
  label: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Rendered below the label/action line at full width. The copy column is
   * narrowed by the action beside it, so anything that must span the row —
   * a reg plate — cannot live inside it.
   */
  footer?: React.ReactNode;
}) {
  return (
    <View>
      <View style={[styles.reviewRow, footer ? styles.reviewRowWithFooter : null]}>
        <View style={styles.reviewCopy}>
          <Text style={styles.reviewLabel}>{label}</Text>
          {children}
        </View>
        {actionLabel && onAction ? (
          <Pressable style={styles.reviewAction} onPress={onAction} accessibilityRole="button">
            <Text style={styles.reviewActionLabel}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {footer ? <View style={styles.reviewFooter}>{footer}</View> : null}
    </View>
  );
}

/**
 * The scroll-driven header both pages share: a white bar that fades in, then a
 * title that follows it. The one component with a caller on each page, which
 * is why it is the kit's centrepiece rather than an afterthought.
 *
 * `barRange` and `titleRange` are scroll offsets. They differ per page — the
 * listing waits for a hero, the review page does not — so they are arguments
 * rather than constants.
 */
export function useScrollHeader({
  barRange,
  titleRange,
  listener,
}: {
  barRange: [number, number];
  titleRange: [number, number];
  /**
   * Optional JS-side observer. The listing drives hero physics off the same
   * value and needs to know when the sheet has covered the photo; the native
   * driver still handles the fades.
   */
  listener?: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
}) {
  const scrollY = useRef(new Animated.Value(0)).current;
  return {
    scrollY,
    /** Pass to Animated.ScrollView's onScroll. */
    onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: true,
      listener,
    }),
    barOpacity: scrollY.interpolate({
      inputRange: barRange,
      outputRange: [0, 1],
      extrapolate: "clamp",
    }),
    // Lags the bar deliberately: the title only appears once the page's own
    // title has scrolled away, so the two are never on screen together.
    titleOpacity: scrollY.interpolate({
      inputRange: titleRange,
      outputRange: [0, 1],
      extrapolate: "clamp",
    }),
  };
}

export function ScrollHeader({
  title,
  topInset,
  barOpacity,
  titleOpacity,
  insetLeft = 68,
  insetRight = 68,
}: {
  title: string;
  topInset: number;
  barOpacity: Animated.AnimatedInterpolation<number>;
  titleOpacity: Animated.AnimatedInterpolation<number>;
  /**
   * Clearance for the controls, per side — they are rarely symmetrical. The
   * listing has one button left and two right, and a shared value put a long
   * title under the share icon.
   */
  insetLeft?: number;
  insetRight?: number;
}) {
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.headerBar, { height: topInset + 56, opacity: barOpacity }]}
      />
      <Animated.Text
        pointerEvents="none"
        numberOfLines={1}
        style={[
          styles.headerTitle,
          { top: topInset + 16, left: insetLeft, right: insetRight, opacity: titleOpacity },
        ]}
      >
        {title}
      </Animated.Text>
    </>
  );
}

const styles = StyleSheet.create({
  rule: { height: 1, backgroundColor: RULE, marginVertical: 28, marginHorizontal: GUTTER },

  sectionBlock: {
    flexDirection: "row", alignItems: "baseline", gap: 12,
    paddingHorizontal: GUTTER, paddingBottom: 12,
  },
  sectionTitle: { flex: 1, minWidth: 0 },
  sectionAction: {
    flexShrink: 0, fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: GREEN,
  },

  pill: {
    marginHorizontal: GUTTER, backgroundColor: PILL, borderRadius: 8,
    height: 46, alignItems: "center", justifyContent: "center",
  },
  pillLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: INK },

  listRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 12 },
  listIcon: { width: 20, flexShrink: 0, alignItems: "center" },
  listLabel: { flex: 1 },

  factRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingVertical: 12 },
  factIcon: { paddingTop: 2 },
  factCopy: { flex: 1, minWidth: 0 },
  factTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: INK },
  factLine: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 21,
    color: MUTED, marginTop: 1,
  },
  factChevron: { marginTop: 2 },

  reviewRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 18 },
  // The footer supplies the bottom padding when there is one.
  reviewRowWithFooter: { paddingBottom: 0 },
  reviewFooter: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18 },
  reviewCopy: { flex: 1, minWidth: 0 },
  reviewLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: INK },
  reviewAction: {
    flexShrink: 0, backgroundColor: PILL, borderRadius: 8,
    paddingHorizontal: 26, paddingVertical: 14,
  },
  reviewActionLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: INK },

  headerBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
    backgroundColor: WHITE,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  headerTitle: {
    position: "absolute", zIndex: 3, textAlign: "center",
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 17, color: INK,
  },
});
