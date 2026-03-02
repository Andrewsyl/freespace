import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth";
import { getMe, updateMe } from "../api";
import type { RootStackParamList } from "../types";
import { cardShadow, colors, radius, spacing } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "PersonalInfo">;

export function PersonalInfoScreen({ navigation }: Props) {
  const { user, token, setAuthUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const originalName = (user?.name ?? "").trim();
  const originalPhone = (user?.phone ?? "").trim();
  const currentName = name.trim();
  const currentPhone = phone.trim();
  const hasChanges = currentName !== originalName || currentPhone !== originalPhone;

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
  }, [user?.name, user?.phone]);

  useEffect(() => {
    const run = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await getMe(token);
        await setAuthUser(res.user);
      } catch {
        // Keep local profile if fetch fails.
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [token, setAuthUser]);

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await updateMe(token, {
        name: currentName || null,
        phone: currentPhone || null,
      });
      await setAuthUser(res.user);
      setMessage("Profile saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Personal information</Text>
        <Text style={styles.subtitle}>Your account details</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email ?? "Not set"}</Text>
            <Text style={[styles.verifyBadge, user?.emailVerified ? styles.verifyBadgeOk : styles.verifyBadgePending]}>
              {user?.emailVerified ? "Verified" : "Not verified"}
            </Text>
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.notice}>{message}</Text> : null}
        <Pressable
          style={[styles.saveButton, (!hasChanges || saving || loading) && styles.saveButtonDisabled]}
          onPress={onSave}
          disabled={!hasChanges || saving || loading}
        >
          {saving || loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  backText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 4,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    ...cardShadow,
  },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  value: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "500",
  },
  verifyBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  verifyBadgeOk: {
    color: "#065f46",
    backgroundColor: "#D1FAE5",
  },
  verifyBadgePending: {
    color: "#92400E",
    backgroundColor: "#FEF3C7",
  },
  input: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "500",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.cardBg,
  },
  saveButton: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  notice: {
    color: colors.accent,
    marginTop: 10,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    marginTop: 10,
    fontSize: 13,
  },
});
