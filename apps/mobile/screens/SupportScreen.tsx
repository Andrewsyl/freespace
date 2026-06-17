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

  if (!token) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <View style={styles.navBar}>
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
              <ArrowLeft size={22} color="#111827" />
            </Pressable>
            <Text style={styles.navTitle}>Contact us</Text>
            <View style={styles.navSpacer} />
          </View>
          <View style={styles.gatedWrap}>
            <View style={styles.gatedCard}>
              <Text style={styles.gatedTitle}>Sign in to contact support</Text>
              <Text style={styles.gatedBody}>
                Log in or create an account so we can attach your message to the right booking and reply properly.
              </Text>
              <Button
                title="Sign in"
                onPress={() =>
                  navigation.navigate("SignIn", {
                    returnTo: {
                      screen: "Support",
                      params: route.params,
                    },
                  })
                }
                style={styles.gatedPrimaryButton}
              />
              <Button
                title="Create account"
                variant="secondary"
                onPress={() =>
                  navigation.navigate("Register", {
                    returnTo: {
                      screen: "Support",
                      params: route.params,
                    },
                  })
                }
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const handleSubmit = async () => {
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
          contentContainerStyle={[styles.content, { paddingBottom: 32 + Math.max(insets.bottom, 16) }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
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
    backgroundColor: "#F4F6F8",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
    backgroundColor: "#ffffff",
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  navTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: "#111827", letterSpacing: -0.3 },
  navSpacer: { width: 38 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
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
  gatedWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  gatedCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  gatedTitle: {
    color: "#111827",
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 24,
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  gatedBody: {
    color: "#4B5563",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 20,
  },
  gatedPrimaryButton: {
    marginBottom: 12,
  },
});
