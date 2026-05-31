import { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import { sendSupportMessage } from "../api";
import { useAuth } from "../auth";
import { useToastOnMessage } from "../components/GlobalToast";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { Button, TextInput as AppTextInput } from "../components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "Support">;

export function SupportScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [subject, setSubject] = useState(route.params?.prefillSubject ?? "");
  const [message, setMessage] = useState(route.params?.prefillMessage ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [menuFrame, setMenuFrame] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const selectRef = useRef<View | null>(null);

  useToastOnMessage(error, { variant: "danger" });
  useToastOnMessage(success, { variant: "success" });

  const subjectOptions = [
    "Booking issue",
    "Payment or refund",
    "Host canceled",
    "Access issue",
    "No-show or overstay",
    "Host payout",
    "Listing problem",
    "Account access",
    "App bug",
    "Other",
  ];
  const canSubmit = !!token && !!subject && message.trim().length >= 10 && !submitting;

  const handleSubmit = async () => {
    if (!token) {
      setError("Please sign in to contact support.");
      return;
    }
    if (!subject) {
      setError("Please select a subject.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Please include a few details (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await sendSupportMessage(token, { subject, message: message.trim() });
      setSuccess("Thanks! We received your message and will reply soon.");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#111827" />
          </Pressable>
          <Text style={styles.navTitle}>Contact us</Text>
          <View style={styles.navSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + Math.max(insets.bottom, spacing.md) }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Contact us</Text>
            <Text style={styles.subtitle}>
              We will reply to {user?.email ?? "your email"} as soon as we can.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Subject</Text>
              <Pressable
                ref={selectRef}
                style={({ pressed }) => [styles.select, pressed && styles.selectPressed]}
                onPress={() => {
                  selectRef.current?.measureInWindow((x, y, width, height) => {
                    const menuHeight = Math.min(320, subjectOptions.length * 44 + 52);
                    const spaceBelow = windowHeight - (y + height + 12);
                    const top =
                      spaceBelow >= menuHeight
                        ? y + height + 8
                        : Math.max(12, y - menuHeight - 8);
                    const left = Math.min(Math.max(12, x), windowWidth - width - 12);
                    setMenuFrame({ top, left, width });
                    setSubjectOpen(true);
                  });
                }}
                accessibilityRole="button"
              >
                <View style={styles.selectValueWrap}>
                  <Text style={styles.selectEyebrow}>Topic</Text>
                  <Text style={[styles.selectText, !subject && styles.selectPlaceholder]}>
                    {subject || "Select a topic"}
                  </Text>
                </View>
                <View style={styles.selectChevronShell}>
                  <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                </View>
              </Pressable>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Message</Text>
              <AppTextInput
                containerStyle={styles.fieldInput}
                style={styles.textArea}
                value={message}
                onChangeText={setMessage}
                placeholder="Tell us what happened and include any booking details."
                multiline
                textAlignVertical="top"
              />
            </View>
            <Button
              title={submitting ? "Sending..." : "Send message"}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
              style={styles.submitButton}
            />
          </View>

        </ScrollView>
        <Modal transparent visible={subjectOpen} animationType="fade" onRequestClose={() => setSubjectOpen(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalScrim} onPress={() => setSubjectOpen(false)} />
            {menuFrame ? (
              <View style={[styles.menuSheet, { top: menuFrame.top, left: menuFrame.left, width: menuFrame.width }]}>
                <Text style={styles.modalTitle}>Choose a topic</Text>
                {subjectOptions.map((option) => (
                  <Pressable
                    key={option}
                    style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
                    onPress={() => {
                      setSubject(option);
                      setSubjectOpen(false);
                    }}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E6E6E4",
    backgroundColor: "#ffffff",
  },
  stickyHeader: {
    backgroundColor: colors.appBg,
    paddingTop: spacing.screenY,
    paddingBottom: spacing.xs,
    zIndex: 5,
  },
  backBtn: { padding: 6, marginLeft: -6 },
  navTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: "#111827" },
  navSpacer: { width: 34 },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 27,
    letterSpacing: -0.8,
    lineHeight: 32,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: "#6B6B6B",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  form: {
    backgroundColor: "transparent",
    paddingHorizontal: spacing.screenX,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    color: "#888888",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  fieldInput: {
    marginBottom: 0,
  },
  select: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  selectPressed: {
    backgroundColor: "#fbfbf9",
  },
  selectValueWrap: {
    flex: 1,
    gap: 2,
  },
  selectEyebrow: {
    color: colors.textSoft,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  selectText: {
    ...textStyles.body,
    color: colors.text,
  },
  selectPlaceholder: {
    color: colors.textSoft,
  },
  selectChevronShell: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.2)",
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  menuSheet: {
    position: "absolute",
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    ...cardShadow,
  },
  modalTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  optionRow: {
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  optionRowPressed: {
    backgroundColor: colors.accentSoft,
  },
  optionText: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 15,
    fontWeight: "600",
  },
  textArea: {
    ...textStyles.body,
    color: colors.text,
    minHeight: 140,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  submitButton: {
    marginTop: spacing.lg,
  },
});
