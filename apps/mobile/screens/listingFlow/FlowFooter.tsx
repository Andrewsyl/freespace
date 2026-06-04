import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { hostFlowColors } from "./hostFlowTheme";
import { spacing } from "../../styles/theme";

type Props = {
  onBack: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
};

export function FlowFooter({ onBack, primaryLabel, onPrimary, primaryDisabled = false, skipLabel, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
      {skipLabel && onSkip ? (
        <Pressable style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>{skipLabel}</Text>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={4}>
          <ArrowLeft size={18} color={hostFlowColors.textMuted} strokeWidth={2.2} />
        </Pressable>
        <Pressable
          style={[styles.primaryButton, primaryDisabled && styles.primaryButtonDisabled]}
          onPress={onPrimary}
          disabled={primaryDisabled}
        >
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: hostFlowColors.cardBg,
    borderTopWidth: 1,
    borderTopColor: hostFlowColors.border,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    flexShrink: 0,
  },
  primaryButton: {
    flex: 1,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: hostFlowColors.accent,
  },
  primaryButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  primaryButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: hostFlowColors.textMuted,
  },
});
