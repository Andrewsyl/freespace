import { useEffect, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ChevronRight, X } from "lucide-react-native";
import { colors } from "../styles/theme";

const INK = colors.text;
const MUTED = colors.textSoft;
const FAINT = colors.textMuted;
const CHEV = colors.textMuted;
const DANGER = colors.danger;

/** Centred bold nav bar used across every Profile sub-page. */
export function DetailNavBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.navBar}>
      <Pressable style={s.backBtn} onPress={onBack} accessibilityLabel="Go back" hitSlop={8}>
        <ArrowLeft size={22} color={INK} strokeWidth={2.4} />
      </Pressable>
      <Text style={s.navTitle} numberOfLines={1}>{title}</Text>
      <View style={s.navSpacer} />
    </View>
  );
}

/** Bold dark section heading (e.g. "Personal info"). */
export function SectionTitle({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.sectionTitle, style]}>{children}</Text>;
}

/** "Label ………… value ›" row. No dividers — spacing separates them. */
export function FieldRow({
  label,
  value,
  onPress,
  danger,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && !!onPress && s.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[s.label, danger && s.danger]}>{label}</Text>
      {value ? (
        <Text style={s.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <ChevronRight size={18} color={CHEV} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}

/**
 * Full-screen editor for a single field (Too Good To Go "Your name" style):
 * back arrow + centred title, a bold field label, the value with a circular
 * clear button, hairlines above/below. Commits on back or keyboard "Done" —
 * there is no save button.
 */
export function FieldEditSheet({
  visible,
  title,
  navTitle,
  initialValue,
  placeholder,
  keyboardType,
  autoCapitalize = "sentences",
  autoComplete,
  saving,
  helpText,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  navTitle?: string;
  initialValue: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words";
  autoComplete?: "name" | "email" | "tel" | "off";
  saving?: boolean;
  helpText?: string;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const dirty = value.trim() !== initialValue.trim();
  const commit = () => {
    if (saving || !dirty) return;
    onSave(value.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={s.page} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={s.navBar}>
          <Pressable style={s.backBtn} onPress={onClose} hitSlop={8} accessibilityLabel="Discard and go back">
            <ArrowLeft size={22} color={INK} strokeWidth={2.4} />
          </Pressable>
          <Text style={s.navTitle} numberOfLines={1}>{navTitle ?? title}</Text>
          <Pressable style={s.navSave} onPress={commit} hitSlop={8} disabled={saving || !dirty} accessibilityLabel="Save">
            <Text style={[s.navSaveText, (saving || !dirty) && s.navSaveDisabled]}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>

        <Text style={s.editLabel}>{title}</Text>
        <View style={s.editRule} />
        <View style={s.editRow}>
          <TextInput
            style={s.editInput}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={FAINT}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={commit}
          />
          {value.length > 0 ? (
            <Pressable onPress={() => setValue("")} hitSlop={10} style={s.clearBtn} accessibilityLabel="Clear">
              <X size={14} color={colors.textInverse} strokeWidth={2.8} />
            </Pressable>
          ) : null}
        </View>
        <View style={s.editRule} />
        {helpText ? <Text style={s.editHelp}>{helpText}</Text> : null}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", marginLeft: -6 },
  navTitle: {
    flex: 1, textAlign: "center",
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 18, color: INK, letterSpacing: -0.3,
  },
  navSpacer: { width: 38 },
  navSave: { minWidth: 38, height: 38, alignItems: "flex-end", justifyContent: "center" },
  navSaveText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 15.5, color: colors.primary, letterSpacing: -0.1,
  },
  navSaveDisabled: { color: FAINT },

  sectionTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 20,
    color: INK, letterSpacing: -0.4, marginTop: 22, marginBottom: 4,
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 18,
  },
  rowPressed: { opacity: 0.55 },
  label: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16.5, color: INK, letterSpacing: -0.2,
  },
  value: {
    flex: 1, textAlign: "right",
    fontFamily: "PlusJakartaSans-Medium", fontSize: 15.5, color: MUTED, letterSpacing: -0.1,
  },
  danger: { color: DANGER },

  page: { flex: 1, backgroundColor: colors.cardBg },
  editLabel: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: INK, letterSpacing: -0.3,
    paddingHorizontal: 20, paddingTop: 26, paddingBottom: 14,
  },
  editRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  editRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  editInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans-Regular", fontSize: 17, color: INK, letterSpacing: -0.2,
    padding: 0,
  },
  clearBtn: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.textDisabled,
  },
  editHelp: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: MUTED, lineHeight: 20,
    paddingHorizontal: 20, paddingTop: 14,
  },
});
