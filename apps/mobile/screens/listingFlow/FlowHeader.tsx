import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
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
  const { draft, listingId } = useListingFlow();
  const { showSuccess } = useGlobalToast();
  const { presentExitConfirm, exitConfirmModal } = useExitListingFlowConfirm();
  const hasDraftToSave = !listingId && hasMeaningfulHostListingDraft(draft);
  const canPromptToSave = current > 2;

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
        <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={8}>
          <ArrowLeft size={17} color={hostFlowColors.text} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.barWrap}>
          <Text style={styles.stepLabel}>Step {current} of {total}</Text>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${percent}%` as `${number}%` }]} />
          </View>
        </View>
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
    backgroundColor: hostFlowColors.cardBg,
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
    gap: 6,
  },
  stepLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: hostFlowColors.textSoft,
    letterSpacing: 0.1,
  },
  bar: {
    height: 4,
    backgroundColor: hostFlowColors.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: hostFlowColors.accent,
    borderRadius: 999,
  },
});
