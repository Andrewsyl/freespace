import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronDown, LifeBuoy } from "lucide-react-native";
import { sendSupportMessage } from "../api";
import { useAuth } from "../auth";
import { useToastOnMessage } from "../components/GlobalToast";
import { Button, TextInput as AppTextInput } from "../components/ui";
import { SignInWall } from "../components/SignInWall";
import { DetailNavBar, SectionTitle } from "../components/profileUi";
import type { RootStackParamList } from "../types";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "Support">;

const SUBJECTS = [
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

export function SupportScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [subject, setSubject] = useState(route.params?.prefillSubject ?? "");
  const [message, setMessage] = useState(route.params?.prefillMessage ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [menuFrame, setMenuFrame] = useState<{ top: number; left: number; width: number } | null>(null);
  const selectRef = useRef<View | null>(null);

  useToastOnMessage(error, { variant: "danger" });
  useToastOnMessage(success, { variant: "success" });

  const canSubmit = !!token && !!subject && message.trim().length >= 10 && !submitting;

  const handleSubmit = async () => {
    if (!token) return;
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

  if (!token) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" />
        <DetailNavBar title="Contact us" onBack={() => goBackOrFallback(navigation, fallbackRoutes.profile)} />
        <SignInWall
          icon={<LifeBuoy size={26} color="#0a8050" strokeWidth={2.2} />}
          title="Sign in to contact support"
          body="Sign in so we can attach your message to the right booking and reply to you properly."
          onSignIn={() => navigation.navigate("Welcome", { returnTo: { screen: "Support", params: route.params } })}
          onBrowse={() => resetToSafeRoute(navigation, fallbackRoutes.search)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <DetailNavBar title="Contact us" onBack={() => goBackOrFallback(navigation, fallbackRoutes.profile)} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 32 + Math.max(insets.bottom, 16) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SectionTitle style={styles.firstSection}>Send us a message</SectionTitle>
          <Text style={styles.help}>Pick a topic and tell us what happened. We usually reply within a day.</Text>

          <Text style={styles.fieldLabel}>Topic</Text>
          <Pressable
            ref={selectRef}
            style={({ pressed }) => [styles.select, pressed && styles.selectPressed]}
            onPress={() => {
              selectRef.current?.measureInWindow((x, y, width, height) => {
                const menuHeight = Math.min(320, SUBJECTS.length * 44 + 52);
                const spaceBelow = windowHeight - (y + height + 12);
                const top = spaceBelow >= menuHeight ? y + height + 8 : Math.max(12, y - menuHeight - 8);
                const left = Math.min(Math.max(12, x), windowWidth - width - 12);
                setMenuFrame({ top, left, width });
                setSubjectOpen(true);
              });
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.selectText, !subject && styles.selectPlaceholder]}>
              {subject || "Select a topic"}
            </Text>
            <ChevronDown size={18} color="#69727D" strokeWidth={2.2} />
          </Pressable>

          <Text style={styles.fieldLabel}>Message</Text>
          <AppTextInput
            containerStyle={styles.inputWrap}
            style={styles.textArea}
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what happened and include any booking details."
            multiline
            textAlignVertical="top"
          />

          <Button
            title={submitting ? "Sending..." : "Send message"}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
            style={styles.submitBtn}
          />
        </ScrollView>

        <Modal transparent visible={subjectOpen} animationType="fade" onRequestClose={() => setSubjectOpen(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSubjectOpen(false)} />
            {menuFrame ? (
              <View style={[styles.menuSheet, { top: menuFrame.top, left: menuFrame.left, width: menuFrame.width }]}>
                <Text style={styles.menuTitle}>Choose a topic</Text>
                {SUBJECTS.map((option) => (
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
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  firstSection: { marginTop: 8 },
  help: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: "#69727D", lineHeight: 20, marginBottom: 20 },
  fieldLabel: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: "#111820",
    letterSpacing: -0.2, marginBottom: 6,
  },
  select: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DFE4E9",
    paddingHorizontal: 0, paddingVertical: 12, marginBottom: 24,
  },
  selectPressed: { opacity: 0.55 },
  selectText: { fontFamily: "PlusJakartaSans-Medium", fontSize: 17, color: "#111820", letterSpacing: -0.2 },
  selectPlaceholder: { color: "#98A2AD", fontFamily: "PlusJakartaSans-Regular" },
  inputWrap: { marginBottom: 0 },
  textArea: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 17, color: "#111820", letterSpacing: -0.2,
    backgroundColor: "transparent", borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DFE4E9", borderRadius: 0,
    minHeight: 130, paddingHorizontal: 0, paddingVertical: 10,
  },
  submitBtn: { marginTop: 24 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.2)" },
  menuSheet: {
    position: "absolute", backgroundColor: "#FFFFFF", borderColor: "#E6EBEF", borderWidth: 1,
    borderRadius: 18, padding: 10,
    shadowColor: "#0B1B33", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 8,
  },
  menuTitle: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: "#69727D",
    marginBottom: 6, paddingHorizontal: 6,
  },
  optionRow: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12 },
  optionRowPressed: { backgroundColor: "#F1FAF5" },
  optionText: { fontFamily: "PlusJakartaSans-Medium", fontSize: 16, color: "#111820" },
});
