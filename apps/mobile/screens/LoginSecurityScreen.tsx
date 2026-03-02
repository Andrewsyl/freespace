import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { deleteAccount, logoutAllSessions } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "LoginSecurity">;

export function LoginSecurityScreen({ navigation }: Props) {
  const { token, logout } = useAuth();

  const handleLogoutAll = () => {
    if (!token) return;
    Alert.alert(
      "Log out of all devices",
      "This will end sessions on all devices. You will need to sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out all",
          style: "destructive",
          onPress: async () => {
            try {
              await logoutAllSessions(token);
              await logout();
            } catch (error) {
              Alert.alert(
                "Could not log out all devices",
                error instanceof Error ? error.message : "Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    if (!token) return;
    Alert.alert(
      "Delete account",
      "This will permanently remove your account, listings, and bookings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount(token);
              await logout();
            } catch (error) {
              Alert.alert(
                "Could not delete account",
                error instanceof Error ? error.message : "Please try again."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color="#111827" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Login & security</Text>
        <Text style={styles.subtitle}>Session and device access</Text>

        <View style={styles.card}>
          <Pressable style={styles.row} onPress={handleLogoutAll}>
            <MaterialIcons name="logout" size={22} color="#B42318" />
            <View style={styles.textWrap}>
              <Text style={styles.rowTitle}>Log out of all devices</Text>
              <Text style={styles.rowSubtitle}>Ends sessions on other phones and browsers</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
          </Pressable>
          <Pressable style={styles.row} onPress={handleDeleteAccount}>
            <MaterialIcons name="delete-outline" size={22} color="#B42318" />
            <View style={styles.textWrap}>
              <Text style={styles.rowTitle}>Delete account</Text>
              <Text style={styles.rowSubtitle}>Remove your data and listings permanently</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "500",
  },
  title: {
    fontSize: 30,
    fontWeight: "600",
    color: "#111827",
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 15,
    marginTop: 4,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  textWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#6B7280",
  },
});
