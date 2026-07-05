import { useEffect, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { UserRound } from "lucide-react-native";
import { useAuth } from "../auth";
import { getMe, updateMe } from "../api";
import { useGlobalToast } from "../components/GlobalToast";
import { SignInWall } from "../components/SignInWall";
import { PhoneVerifyModal } from "../components/PhoneVerifyModal";
import { DetailNavBar, FieldEditSheet, FieldRow, SectionTitle } from "../components/profileUi";
import type { RootStackParamList } from "../types";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "PersonalInfo">;

export function PersonalInfoScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user, token, setAuthUser } = useAuth();
  const { showError, showSuccess } = useGlobalToast();
  const [editing, setEditing] = useState<null | "name" | "email">(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (route.params?.notice) showSuccess(route.params.notice);
  }, [route.params?.notice, showSuccess]);

  useEffect(() => {
    if (route.params?.focusField === "phone") setPhoneOpen(true);
  }, [route.params?.focusField]);

  const saveField = async (field: "name" | "email", value: string) => {
    if (!token || !user) return;
    setSaving(true);
    try {
      const payload: { name: string | null; email: string | null; phone: string | null } = {
        name: user.name ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
      };
      payload[field] = value || null;
      const res = await updateMe(token, payload);
      await setAuthUser(res.user);
      setEditing(null);
      showSuccess(
        field === "email"
          ? "Email updated. Check your inbox to verify your new address."
          : "Saved."
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  if (!token || !user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" />
        <DetailNavBar title="Personal information" onBack={() => goBackOrFallback(navigation, fallbackRoutes.profile)} />
        <SignInWall
          icon={<UserRound size={26} color="#0a8050" strokeWidth={2.2} />}
          title="Sign in to edit your profile"
          body="Your name, email and phone number are available once you sign in."
          onSignIn={() => navigation.navigate("Welcome")}
          onBrowse={() => resetToSafeRoute(navigation, fallbackRoutes.search)}
        />
      </SafeAreaView>
    );
  }

  const emailStatus = user.emailVerified ? user.email : `${user.email ?? "Add"}`;
  const phoneStatus = user.phone
    ? user.phoneVerified
      ? user.phone
      : `${user.phone} · Verify`
    : "Add";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <DetailNavBar title="Personal information" onBack={() => goBackOrFallback(navigation, fallbackRoutes.profile)} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 32 + Math.max(insets.bottom, 16) }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle style={styles.firstSection}>Personal info</SectionTitle>
        <FieldRow label="Name" value={user.name?.trim() || "Add"} onPress={() => setEditing("name")} />
        <FieldRow label="Email" value={emailStatus} onPress={() => setEditing("email")} />
        <FieldRow label="Phone number" value={phoneStatus} onPress={() => setPhoneOpen(true)} />
      </ScrollView>

      <FieldEditSheet
        visible={editing === "name"}
        title="Name"
        navTitle="Your name"
        initialValue={user.name ?? ""}
        placeholder="Enter your name"
        autoCapitalize="words"
        autoComplete="name"
        saving={saving}
        onSave={(v) => saveField("name", v)}
        onClose={() => setEditing(null)}
      />
      <FieldEditSheet
        visible={editing === "email"}
        title="Email"
        navTitle="Your email"
        initialValue={user.email ?? ""}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        helpText="We'll email a link to confirm your new address."
        saving={saving}
        onSave={(v) => saveField("email", v)}
        onClose={() => setEditing(null)}
      />
      <PhoneVerifyModal
        visible={phoneOpen}
        token={token}
        initialPhone={user.phone}
        onClose={() => setPhoneOpen(false)}
        onVerified={() => {
          setPhoneOpen(false);
          void getMe(token)
            .then((p) => setAuthUser(p.user))
            .catch(() => undefined);
          showSuccess("Phone number verified.");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  firstSection: { marginTop: 8 },
});
