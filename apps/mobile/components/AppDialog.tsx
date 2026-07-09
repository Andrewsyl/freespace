import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CircleCheck, CircleX, TriangleAlert, type LucideIcon } from "lucide-react-native";
import { colors, radius, floatingShadow } from "../styles/theme";

// In-app replacement for OS Alert.alert on branded flows: a centered card over
// a dark scrim, matching the app's success-moment overlay language. Success
// and error are single-acknowledgement; confirm carries two actions.
export type DialogTone = "success" | "error" | "confirm";

export type DialogAction = {
  label: string;
  // Optional side effect; the dialog always closes after a press.
  onPress?: () => void;
  variant?: "primary" | "danger" | "neutral";
};

type Props = {
  visible: boolean;
  tone?: DialogTone;
  title: string;
  message?: string;
  actions: DialogAction[];
  onRequestClose: () => void;
};

const TONE: Record<DialogTone, { Icon: LucideIcon; iconColor: string; bg: string }> = {
  success: { Icon: CircleCheck, iconColor: colors.primary, bg: colors.accentSoft },
  error: { Icon: CircleX, iconColor: colors.danger, bg: colors.status.canceled.background },
  confirm: { Icon: TriangleAlert, iconColor: colors.danger, bg: colors.status.canceled.background },
};

export function AppDialog({ visible, tone = "success", title, message, actions, onRequestClose }: Props) {
  const { Icon, iconColor, bg } = TONE[tone];
  const stacked = actions.length > 1;

  const handlePress = (action: DialogAction) => {
    onRequestClose();
    action.onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onRequestClose}>
      {/* Tapping the scrim dismisses only single-action dialogs; a confirm
          must be answered by choosing an explicit action. */}
      <Pressable style={styles.scrim} onPress={tone === "confirm" ? undefined : onRequestClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.iconWrap, { backgroundColor: bg }]}>
            <Icon size={26} color={iconColor} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={[styles.actions, stacked && styles.actionsRow]}>
            {actions.map((action) => {
              const variant = action.variant ?? "primary";
              return (
                <Pressable
                  key={action.label}
                  onPress={() => handlePress(action)}
                  style={({ pressed }) => [
                    styles.button,
                    stacked && styles.buttonFlex,
                    variant === "primary" && styles.buttonPrimary,
                    variant === "danger" && styles.buttonDanger,
                    variant === "neutral" && styles.buttonNeutral,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      (variant === "primary" || variant === "danger") && styles.buttonTextInverse,
                      variant === "neutral" && styles.buttonTextNeutral,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: "center",
    ...floatingShadow,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 19,
    color: colors.text,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  message: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 8,
  },
  actions: {
    alignSelf: "stretch",
    marginTop: 22,
    gap: 10,
  },
  actionsRow: {
    flexDirection: "row",
  },
  button: {
    minHeight: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonFlex: { flex: 1 },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonDanger: { backgroundColor: colors.danger },
  buttonNeutral: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border },
  buttonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  buttonTextInverse: { color: colors.textInverse },
  buttonTextNeutral: { color: colors.text },
});
