import { useEffect } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import freeSpaceLogo from "../assets/logo-freespace-black-hd.png";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigation.replace("Tabs", { screen: "Search" });
    }
  }, [navigation, user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image
            source={freeSpaceLogo}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Image
          source={require("../assets/car-illustration.png")}
          style={styles.illustration}
          resizeMode="contain"
        />

        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={() => navigation.navigate("Register")}
        >
          <Text style={styles.buttonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: "100%",
    height: 170,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    overflow: "visible",
  },
  logo: {
    width: 430,
    height: 190,
    transform: [{ scale: 2.1 }],
  },
  illustration: {
    width: 408,
    height: 268,
    marginBottom: 28,
  },
  getStartedButton: {
    backgroundColor: "#4A9EFF",
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
    shadowColor: "#4A9EFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  loginText: {
    fontSize: 14,
    color: "#6B7280",
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A9EFF",
  },
});
