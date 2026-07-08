import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { hostFlowColors } from "./hostFlowTheme";
import { useExitListingFlowConfirm } from "./confirmExit";
import { useListingFlow } from "./context";
import { hasMeaningfulHostListingDraft, saveHostListingDraft } from "./draftStorage";
import { useGlobalToast } from "../../components/GlobalToast";

type Props = {
  current: number;
  total: number;
  onClose: () => void;
};

export function FlowHeader({ current, total, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const percent = total > 0 ? Math.min(Math.max(current / total, 0), 1) * 100 : 0;
  const prevPercent = total > 0 ? Math.min(Math.max((current - 1) / total, 0), 1) * 100 : 0;
  const fillAnim = useRef(new Animated.Value(prevPercent)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: percent,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { draft, listingId } = useListingFlow();
  const { showSuccess } = useGlobalToast();
  const { presentExitConfirm, exitConfirmModal } = useExitListingFlowConfirm();
  const hasDraftToSave = !listingId && hasMeaningfulHostListingDraft(draft);
  const canPromptToSave = current > 2 || hasDraftToSave;

  const handleClose = () => {
    if (!canPromptToSave) {
      onClose();
      return;
    }
    presentExitConfirm({
      canSave: hasDraftToSave,
      onConfirm: async () => {
      if (hasDraftToSave) {
        await saveHostListingDraft(draft);
        showSuccess("Saved to Listings. Finish it anytime.");
      }
      onClose();
    },
      message: hasDraftToSave
        ? "We'll save this unfinished listing to Listings so you can come back and complete it later."
        : "Your space isn't published yet. If you leave now, any unpublished changes will be lost.",
    });
  };

  return (
    <>
      <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={14} accessibilityLabel="Close">
          <X size={17} color={hostFlowColors.text} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.barWrap}>
          <View style={styles.bar}>
            <Animated.View style={[styles.fill, { width: fillAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }]} />
          </View>
        </View>
        <Text style={styles.stepCount}>{current}/{total}</Text>
      </View>
      {exitConfirmModal}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: hostFlowColors.bg,
    borderBottomWidth: 1,
    borderBottomColor: hostFlowColors.border,
  },
  closeBtn: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  barWrap: {
    flex: 1,
  },
  bar: {
    height: 6,
    backgroundColor: hostFlowColors.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  stepCount: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: hostFlowColors.textMuted,
    flexShrink: 0,
    minWidth: 28,
    textAlign: "right",
  },
  fill: {
    height: "100%",
    backgroundColor: hostFlowColors.accent,
    borderRadius: 999,
  },
});
