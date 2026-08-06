import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { colors, displayScale, radius, scaleDisplay, textStyles } from "../../styles/theme";

/**
 * The white surface at the top of a screen, closed with the system's `divider`
 * rule. Everything below it sits on the ground.
 *
 * Two variants:
 *   page — 30/800 title stacked under the back control. The subject of the
 *          screen (a listing, a booking).
 *   step — 19/800 title inline with the back control, with a sub-line for
 *          progress. Flow screens, where the title names the step rather than
 *          the thing.
 *
 * Children render inside the surface, below the title — a fact stack, a
 * progress bar, whatever the screen leads with.
 */
export function Masthead({
  title,
  subtitle,
  onBack,
  variant = "page",
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  variant?: "page" | "step";
  children?: React.ReactNode;
}) {
  const isStep = variant === "step";

  return (
    <View style={styles.surface}>
      {isStep ? (
        <View style={styles.stepRow}>
          {onBack ? <BackControl onBack={onBack} /> : null}
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          {onBack ? (
            <View style={styles.pageBack}>
              <BackControl onBack={onBack} />
            </View>
          ) : null}
          <Text style={textStyles.dsTitle}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </>
      )}
      {children}
    </View>
  );
}

function BackControl({ onBack }: { onBack: () => void }) {
  return (
    <Pressable
      style={styles.backButton}
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
    >
      <ArrowLeft size={18} color={colors.text} strokeWidth={2.3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.appBg,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pageBack: { marginBottom: 16 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepCopy: { flex: 1, minWidth: 0 },
  // 22, matching what the checkout ships today. Whether flow screens settle on
  // this or the tighter 19 is still open — when it's decided, it changes here
  // once rather than across every flow screen.
  stepTitle: {
    ...textStyles.dsSection,
    fontSize: scaleDisplay(22),
    lineHeight: scaleDisplay(27),
    letterSpacing: -0.6 * displayScale,
  },
  subtitle: {
    ...textStyles.dsBody,
    color: colors.textTertiary,
    marginTop: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.ground,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
