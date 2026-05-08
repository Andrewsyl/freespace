import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import * as SplashScreen from "expo-splash-screen";
import { StripeProvider } from "@stripe/stripe-react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { AuthProvider, useAuth } from "./auth";
import { AppLaunchContext } from "./appLaunch";
import { FavoritesProvider } from "./favorites";
import { HistoryScreen } from "./screens/HistoryScreen";
import { FavoritesScreen } from "./screens/FavoritesScreen";
import { BookingSummaryScreen } from "./screens/BookingSummaryScreen";
import { VehicleTypeScreen } from "./screens/VehicleTypeScreen";
import { ListingScreen } from "./screens/ListingScreen";
import { ListingsScreen } from "./screens/ListingsScreen";
import { PaymentsScreen } from "./screens/PaymentsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PersonalInfoScreen } from "./screens/PersonalInfoScreen";
import { LoginSecurityScreen } from "./screens/LoginSecurityScreen";
import { LegalScreen } from "./screens/LegalScreen";
import { BookingDetailScreen } from "./screens/BookingDetailScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { ListingReviewsScreen } from "./screens/ListingReviewsScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { RegisterScreen } from "./screens/RegisterScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { ResetPasswordScreen } from "./screens/ResetPasswordScreen";
import { ListingFlowScreen } from "./screens/ListingFlowScreen";
import { EditListingScreen } from "./screens/EditListingScreen";
import { SupportScreen } from "./screens/SupportScreen";
import { AdminScreen } from "./screens/AdminScreen";
import type { RootStackParamList } from "./types";
import { registerPushToken } from "./api";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabButton } from "./components/BottomTabButton";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { GlobalLoadingProvider, useGlobalLoading } from "./components/GlobalLoading";
import { mobileEnv } from "./env";
import { installGlobalErrorLogging } from "./logger";
import { colors } from "./theme/colors";
import { radius, spacing as appSpacing, textStyles } from "./styles/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

enableScreens(false);
void SplashScreen.preventAutoHideAsync();
installGlobalErrorLogging();

if (mobileEnv.sentryDsn) {
  getSentry()?.init({
    dsn: mobileEnv.sentryDsn,
    enabled: true,
    enableNativeFramesTracking: false,
    environment: mobileEnv.appEnv ?? (__DEV__ ? "local" : "production"),
    tracesSampleRate: 0,
  });
}

function getSentry():
  | {
      init: (options: {
        dsn: string;
        enabled: boolean;
        enableNativeFramesTracking: boolean;
        environment: string;
        tracesSampleRate: number;
      }) => void;
    }
  | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@sentry/react-native");
  } catch {
    return null;
  }
}

export default function App() {
  const [launchComplete, setLaunchComplete] = useState(true);
  const [fontsLoaded] = useFonts({
    "Inter-Regular": require("./assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("./assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("./assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("./assets/fonts/Inter-Bold.ttf"),
    "Poppins-Regular": require("./assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Medium": require("./assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("./assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Bold": require("./assets/fonts/Poppins-Bold.ttf"),
    "PlusJakartaSans-Regular": PlusJakartaSans_400Regular,
    "PlusJakartaSans-SemiBold": PlusJakartaSans_600SemiBold,
    "PlusJakartaSans-Bold": PlusJakartaSans_700Bold,
    "UKNumberPlate": require("./assets/fonts/UKNumberPlate.ttf"),
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    void Notifications.requestPermissionsAsync();
    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  }, []);

  const appLaunchValue = useMemo(
    () => ({
      launchComplete,
      setLaunchComplete,
    }),
    [launchComplete]
  );


  const stripeKey = mobileEnv.stripePublishableKey;

  if (!fontsLoaded) {
    return <View style={styles.app} />;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.app}>
        <StripeProvider publishableKey={stripeKey} urlScheme="carparking">
          <AuthProvider>
            <FavoritesProvider>
              <GlobalLoadingProvider>
                <AppLaunchContext.Provider value={appLaunchValue}>
                  <AppShell />
                </AppLaunchContext.Provider>
              </GlobalLoadingProvider>
            </FavoritesProvider>
          </AuthProvider>
        </StripeProvider>
      </View>
    </SafeAreaProvider>
  );
}

function GlobalLoadingOverlay() {
  const { loading } = useAuth();
  const { state } = useGlobalLoading();
  const visible = loading || state.visible;
  const message = loading ? "Signing in..." : state.message;
  return <LoadingOverlay visible={visible} message={message} />;
}

function AppShell() {
  const { user, legalPromptRequired } = useAuth();
  const requiresLegal = !!user && (!user.termsVersion || !user.privacyVersion);
  const shouldShowLegalGate = requiresLegal && legalPromptRequired;
  const runtimeAppEnv =
    (Constants.expoConfig as { extra?: { appEnv?: string } } | null)?.extra?.appEnv ??
    process.env.APP_ENV ??
    (__DEV__ ? "local" : "production");
  const normalizedAppEnv = runtimeAppEnv.trim().toLowerCase();
  const showEnvBadge = normalizedAppEnv !== "production";

  useEffect(() => {
    if (!shouldShowLegalGate || !navigationRef.isReady()) return;
    const current = navigationRef.getCurrentRoute()?.name;
    if (current !== "SignIn") {
      navigationRef.navigate("SignIn");
    }
  }, [shouldShowLegalGate]);

  return (
    <>
      <AppNavigator />
      {showEnvBadge ? <EnvironmentBadge env={normalizedAppEnv} /> : null}
      {shouldShowLegalGate ? <LegalGate /> : null}
      <GlobalLoadingOverlay />
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
    </>
  );
}

function EnvironmentBadge({ env }: { env: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.envBadge, { top: Math.max(8, insets.top + 6) }]}>
      <Text style={styles.envBadgeText}>{env.toUpperCase()}</Text>
    </View>
  );
}

const TransparentTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };

function AppNavigator() {
  return (
    <>
      <NavigationContainer ref={navigationRef} theme={TransparentTheme}>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName="Tabs"
        >
          <Stack.Screen name="Tabs" component={MainTabs} />
          <Stack.Screen
            name="Listing"
            component={ListingScreen}
            options={{ contentStyle: { backgroundColor: 'transparent' }, statusBarTranslucent: true }}
          />
          <Stack.Screen name="Listings" component={ListingsScreen} />
          <Stack.Screen name="BookingSummary" component={BookingSummaryScreen} />
          <Stack.Screen name="VehicleType" component={VehicleTypeScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Favorites" component={FavoritesScreen} />
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
          <Stack.Screen name="LoginSecurity" component={LoginSecurityScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
          <Stack.Screen name="Review" component={ReviewScreen} />
          <Stack.Screen name="ListingReviews" component={ListingReviewsScreen} />
          <Stack.Screen name="Support" component={SupportScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="CreateListingFlow" component={ListingFlowScreen} />
          <Stack.Screen name="EditListing" component={EditListingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <PushRegistration />
    </>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const baseTabBarStyle = {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 6,
    paddingTop: 6,
    paddingBottom: Math.max(8, insets.bottom),
    height: 58 + Math.max(8, insets.bottom),
  };
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.teal,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: baseTabBarStyle,
        tabBarLabelStyle: {
          ...textStyles.tabLabel,
          marginTop: 1,
        },
        tabBarButton: (props) => <BottomTabButton {...props} />,
      }}
    >
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={({ route }) => ({
          tabBarStyle: {
            ...baseTabBarStyle,
            display: (route.params as { hideTabBar?: boolean } | undefined)?.hideTabBar ? "none" : "flex",
          },
          tabBarLabel: "Search",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons 
              name={focused ? "search" : "search-outline"} 
              size={24} 
              color={color} 
            />
          ),
        })}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: "Bookings",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons 
              name={focused ? "calendar" : "calendar-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Account",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons 
              name={focused ? "person" : "person-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function LegalGate() {
  const { user, acceptLegal, logout, legalPromptRequired } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legalVersion = "2026-01-10";
  const requiresLegal = !!user && (!user.termsVersion || !user.privacyVersion);
  const shouldShowLegalGate = requiresLegal && legalPromptRequired;

  if (!shouldShowLegalGate) return null;

  const handleContinue = async () => {
    if (!accepted) {
      setError("Please accept the Terms & Privacy to continue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await acceptLegal({ termsVersion: legalVersion, privacyVersion: legalVersion });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save acceptance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.legalOverlay} pointerEvents="auto">
      <View style={styles.legalCard}>
        <Text style={styles.legalTitle}>Terms & Privacy</Text>
        <Text style={styles.legalBody}>
          Please accept the Terms & Privacy to continue using the app.
        </Text>
        <Pressable
          style={styles.legalRow}
          onPress={() => setAccepted((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
        >
          <View style={[styles.legalCheckbox, accepted && styles.legalCheckboxChecked]}>
            {accepted ? <View style={styles.legalCheckboxInner} /> : null}
          </View>
          <Text style={styles.legalText}>I agree to the Terms & Privacy.</Text>
        </Pressable>
        {error ? <Text style={styles.legalError}>{error}</Text> : null}
        <View style={styles.legalActions}>
          <Pressable style={styles.legalSecondary} onPress={logout} disabled={saving}>
            <Text style={styles.legalSecondaryText}>Sign out</Text>
          </Pressable>
          <Pressable
            style={[styles.legalPrimary, !accepted && styles.legalPrimaryDisabled]}
            onPress={handleContinue}
            disabled={!accepted || saving}
          >
            <Text style={styles.legalPrimaryText}>{saving ? "Saving..." : "Continue"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PushRegistration() {
  const { token, user } = useAuth();
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !user) return;
    let active = true;

    const register = async () => {
      const permissions = await Notifications.getPermissionsAsync();
      if (!permissions.granted) {
        const request = await Notifications.requestPermissionsAsync();
        if (!request.granted) {
          console.warn("Push registration skipped: permissions not granted");
          return;
        }
      }
      const projectId =
        Constants.easConfig?.projectId ??
        (Constants.expoConfig as any)?.extra?.eas?.projectId;
      if (__DEV__ && !projectId) {
        console.warn("Push registration: missing EAS projectId (Expo token may be null)");
      }
      const expoTokenResult = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      const expoToken = expoTokenResult.data;
      if (!expoToken || !active) {
        console.warn("Push registration skipped: no Expo token");
        return;
      }
      if (lastTokenRef.current === expoToken) return;
      await registerPushToken({
        token,
        expoToken,
        platform: Platform.OS,
        deviceId: Constants.deviceId ?? Constants.deviceName ?? undefined,
      });
      if (__DEV__) {
        console.log("Push registration: token stored");
      }
      lastTokenRef.current = expoToken;
    };

    void register().catch((error) => {
      console.warn("Push registration failed", error);
    });
    return () => {
      active = false;
    };
  }, [token, user]);

  return null;
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: "#FCFCFB",
  },
  envBadge: {
    backgroundColor: "#111827",
    borderRadius: radius.pill,
    opacity: 0.9,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: "absolute",
    right: appSpacing.screenX,
    zIndex: 999,
  },
  envBadgeText: {
    color: colors.text.inverse,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  legalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  legalBody: {
    color: colors.text.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  legalCard: {
    backgroundColor: colors.surface,
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    width: "100%",
  },
  legalCheckbox: {
    alignItems: "center",
    borderColor: colors.brand.tealSoft,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    marginRight: 10,
    width: 20,
  },
  legalCheckboxChecked: {
    backgroundColor: colors.brand.teal,
    borderColor: colors.brand.teal,
  },
  legalCheckboxInner: {
    backgroundColor: colors.surface,
    borderRadius: 2,
    height: 6,
    width: 6,
  },
  legalError: {
    color: colors.error.strong,
    fontSize: 12,
    marginTop: 10,
  },
  legalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: colors.overlay.strong,
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 1000,
  },
  legalPrimary: {
    backgroundColor: colors.brand.teal,
    borderRadius: 12,
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  legalPrimaryDisabled: {
    opacity: 0.5,
  },
  legalPrimaryText: {
    color: colors.text.inverse,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  legalRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 14,
  },
  legalSecondary: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  legalSecondaryText: {
    color: colors.text.slate,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  legalText: {
    color: colors.text.dark,
    fontSize: 13,
    fontWeight: "500",
  },
  legalTitle: {
    color: colors.text.dark,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
});
