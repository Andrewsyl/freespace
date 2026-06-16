import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { NavigationContainer, CommonActions, DefaultTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { AnimatedSplash } from "./components/AnimatedSplash";
import { StripeProvider } from "@stripe/stripe-react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { CalendarDays, Compass, UserRound } from "lucide-react-native";
import { AuthProvider, EXPO_PUSH_TOKEN_KEY, useAuth } from "./auth";
import { FavoritesProvider } from "./favorites";
import { HistoryScreen } from "./screens/HistoryScreen";
import { FavoritesScreen } from "./screens/FavoritesScreen";
import { BookingSummaryScreen } from "./screens/BookingSummaryScreen";
import { VehicleTypeScreen } from "./screens/VehicleTypeScreen";
import { ListingScreen } from "./screens/ListingScreen";
import { ListingsScreen } from "./screens/ListingsScreen";
import { HostBookingDetailScreen } from "./screens/HostBookingDetailScreen";
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
import { OnboardingPermissions } from "./screens/OnboardingPermissionsScreen";
import type { RootStackParamList } from "./types";
import { getMe, registerPushToken, verifyEmailToken } from "./api";
import { BottomTabButton } from "./components/BottomTabButton";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { GlobalLoadingProvider, useGlobalLoading } from "./components/GlobalLoading";
import { GlobalToastProvider } from "./components/GlobalToast";
import { useGlobalToast } from "./components/GlobalToast";
import {
  clearMobileE2EScenario,
  configureMobileE2EScenario,
  getMobileE2EState,
  mobileE2EEnabled,
} from "./e2e/testMode";
import { mobileEnv } from "./env";
import { installGlobalErrorLogging } from "./logger";
import { colors } from "./theme/colors";
import { radius, spacing as appSpacing } from "./styles/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

type BookingNotificationData = {
  type?: string;
  historyTab?: "upcoming" | "active" | "past";
  bookingId?: string;
};

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
  const [fontsLoaded] = useFonts({
    "PlusJakartaSans-Regular": require("./assets/fonts/PlusJakartaSans_400Regular.ttf"),
    "PlusJakartaSans-Medium": require("./assets/fonts/PlusJakartaSans_500Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("./assets/fonts/PlusJakartaSans_600SemiBold.ttf"),
    "PlusJakartaSans-Bold": require("./assets/fonts/PlusJakartaSans_700Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("./assets/fonts/PlusJakartaSans_800ExtraBold.ttf"),
    "UKNumberPlate": require("./assets/fonts/UKNumberPlate.ttf"),
  });


  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("default", {
        name: "General",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      // Time-critical "starts soon"/"ends soon" reminders get their own
      // high-importance channel so users can't lose them by muting general
      // updates (and vice versa). Channel settings stick once created.
      void Notifications.setNotificationChannelAsync("booking-reminders", {
        name: "Booking reminders",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    // Register the "Extend +" action shown on the server-sent "ends soon"
    // reminder (categoryId: "booking_ending"). Registered globally at startup
    // so the action is available whenever the push arrives.
    void Notifications.setNotificationCategoryAsync("booking_ending", [
      {
        identifier: "extend_booking",
        buttonTitle: "Extend +",
        options: { opensAppToForeground: true },
      },
    ]);
  }, []);

  const stripeKey = mobileEnv.stripePublishableKey;

  if (!fontsLoaded) {
    return <View style={[styles.app, { backgroundColor: "#ffffff" }]} />;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.app}>
        {/* merchantIdentifier must match the in-app-payments entitlement; without
            it the Payment Sheet silently hides Apple Pay. */}
        <StripeProvider
          publishableKey={stripeKey}
          merchantIdentifier="merchant.com.andrewsyl.carparking"
        >
          <AuthProvider>
            <FavoritesProvider>
              <GlobalLoadingProvider>
                <GlobalToastProvider>
                  <AppShell />
                </GlobalToastProvider>
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

function AuthToastBridge() {
  const { user, loading } = useAuth();
  const { show } = useGlobalToast();
  const initialLoadDoneRef = useRef(false);
  const prevUserRef = useRef<typeof user>(undefined);

  useEffect(() => {
    if (loading) return;
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      prevUserRef.current = user;
      return;
    }
    const prev = prevUserRef.current;
    prevUserRef.current = user;
    if (!prev && user) {
      const firstName = user.name?.trim().split(" ")[0];
      show(firstName ? `Welcome back, ${firstName}!` : "Welcome back!", {
        variant: "success",
        durationMs: 3500,
      });
    } else if (prev && !user) {
      show("You've been signed out", { variant: "info", durationMs: 3000 });
    }
  }, [user, loading, show]);

  return null;
}

function SplashController() {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);
  return null;
}

const ONBOARDING_KEY = "@carpark/onboarding_done";

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
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingResolved, setOnboardingResolved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => {
        if (!v) setShowOnboarding(true);
      })
      .catch(() => {})
      .finally(() => setOnboardingResolved(true));
  }, []);

  const handleOnboardingComplete = () => {
    void AsyncStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  };

  return (
    <>
      <SplashController />
      {onboardingResolved && !showOnboarding ? <AppNavigator /> : null}
      {showAnimatedSplash && (
        <AnimatedSplash onFinish={() => setShowAnimatedSplash(false)} />
      )}
      {showOnboarding && !showAnimatedSplash ? (
        <OnboardingPermissions onComplete={handleOnboardingComplete} />
      ) : null}
      <AuthToastBridge />
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
  const { token, setAuthUser, hydrateSession } = useAuth();
  const { showError, showSuccess } = useGlobalToast();

  useEffect(() => {
    const openNotificationTarget = (
      data: BookingNotificationData | Record<string, unknown> | null | undefined
    ) => {
      if (!data || typeof data !== "object") return;
      // All booking-related notifications (status changes, reminders, review
      // prompt) deep-link into the History tab. Keep this in sync with the
      // `type` values the server sends in apps/api/src/lib/notifications.ts and
      // sendBookingStatusPush.
      const bookingTypes = new Set([
        "booking_confirmed",
        "booking_canceled",
        "booking_reminder",
        "booking_start_soon",
        "booking_end_soon",
        "booking_extend_prompt",
        "review_reminder",
      ]);
      if (typeof data.type !== "string" || !bookingTypes.has(data.type)) return;
      const initialTab =
        data.historyTab === "active" || data.historyTab === "past" ? data.historyTab : "upcoming";
      navigationRef.dispatch(
        CommonActions.navigate({
          name: "Tabs",
          params: {
            screen: "History",
            params: {
              initialTab,
              refreshToken: Date.now(),
            },
          } as RootStackParamList["Tabs"],
        })
      );
    };

    // On cold start from a notification tap the navigator isn't ready yet when
    // this resolves — poll briefly instead of dropping the deep-link.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as BookingNotificationData;
      let attempts = 0;
      const navigateWhenReady = () => {
        if (!navigationRef.isReady()) {
          if (attempts < 100) {
            attempts += 1;
            setTimeout(navigateWhenReady, 50);
          }
          return;
        }
        openNotificationTarget(data);
      };
      navigateWhenReady();
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as BookingNotificationData;
      // "Extend +" action button on ending-soon notification
      if (response.actionIdentifier === "extend_booking") {
        navigationRef.dispatch(
          CommonActions.navigate({
            name: "Tabs",
            params: {
              screen: "History",
              params: { initialTab: "active", refreshToken: Date.now() },
            } as RootStackParamList["Tabs"],
          })
        );
        return;
      }
      openNotificationTarget(data);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    const handledUrls = new Set<string>();

    const handleUrl = async (url: string | null | undefined) => {
      if (!active || !url || handledUrls.has(url)) return;
      handledUrls.add(url);
      const parsed = Linking.parse(url);
      const pathCandidate =
        ("hostname" in parsed && typeof parsed.hostname === "string" && parsed.hostname) ||
        parsed.path ||
        "";
      const path = pathCandidate.replace(/^\/+/, "");
      const tokenParam = typeof parsed.queryParams?.token === "string" ? parsed.queryParams.token : null;
      const apiBaseParam =
        typeof parsed.queryParams?.apiBase === "string" ? parsed.queryParams.apiBase : undefined;
      if (path === "e2e") {
        if (!mobileE2EEnabled) return;
        const scenarioName =
          typeof parsed.queryParams?.scenario === "string" ? parsed.queryParams.scenario : "guest-smoke";
        const scenario =
          scenarioName === "reset"
            ? (clearMobileE2EScenario(), null)
            : configureMobileE2EScenario(scenarioName);
        await hydrateSession(scenario?.authSession ?? null);
        const navigateToScenario = () => {
          if (!navigationRef.isReady()) {
            setTimeout(navigateToScenario, 50);
            return;
          }
          const target = getMobileE2EState()?.route ?? {
            name: "Tabs" as const,
            params: { screen: "Search" as const },
          };
          navigationRef.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: target.name, params: target.params }],
            })
          );
          showSuccess(`Loaded ${scenario?.name ?? "guest-smoke"} mobile test scenario.`);
        };
        navigateToScenario();
        return;
      }
      if (path === "reset-password") {
        if (!tokenParam) {
          showError("Reset link is missing its token.");
          return;
        }
        if (navigationRef.isReady()) {
          navigationRef.dispatch(
            CommonActions.navigate({
              name: "ResetPassword",
              params: {
                token: tokenParam,
                apiBase: apiBaseParam,
              } as RootStackParamList["ResetPassword"],
            })
          );
        }
        return;
      }
      if (path !== "verify-email") return;
      if (!tokenParam) {
        showError("Verification link is missing its token.");
        return;
      }
      try {
        await verifyEmailToken(tokenParam, apiBaseParam);
        if (token) {
          const profile = await getMe(token, apiBaseParam);
          await setAuthUser(profile.user);
        }
        showSuccess("Email verified. You can continue in the app.");
        if (navigationRef.isReady()) {
          navigationRef.dispatch(
            CommonActions.navigate({
              name: "Tabs",
              params: {
                screen: "Profile",
              } as RootStackParamList["Tabs"],
            })
          );
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : "Email verification failed");
      }
    };

    void Linking.getInitialURL().then((url) => {
      void handleUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [hydrateSession, setAuthUser, showError, showSuccess, token]);

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
          <Stack.Screen name="HostBookingDetail" component={HostBookingDetailScreen} />
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
  const bottomPadding = Math.max(8, insets.bottom);
  const baseTabBarStyle = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingTop: 4,
    paddingBottom: bottomPadding,
    height: 58 + bottomPadding,
  };

  const renderTabIcon = (
    focused: boolean,
    color: string,
    Icon: typeof Compass | typeof CalendarDays | typeof UserRound
  ) => (
    <View style={[styles.navIconShell, focused && styles.navIconShellActive]}>
      <Icon
        size={focused ? 18 : 20}
        color={focused ? "#FFFFFF" : color}
        strokeWidth={focused ? 2.3 : 2}
      />
    </View>
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#0a8050",
        tabBarInactiveTintColor: "#98a4ab",
        tabBarStyle: baseTabBarStyle,
        tabBarBackground: () => <View style={styles.tabBarChrome} />,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
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
          tabBarLabel: "Discover",
          tabBarIcon: ({ focused, color }) => renderTabIcon(focused, color, Compass),
        })}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: "Bookings",
          tabBarIcon: ({ focused, color }) => renderTabIcon(focused, color, CalendarDays),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ focused, color }) => renderTabIcon(focused, color, UserRound),
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
    if (!token || !user) {
      // Signed out (or mid account-switch on a shared device): forget the
      // registered token. The Expo push token is stable per device, so without
      // this the guard below would skip re-registering the next user and they'd
      // receive no notifications until an app restart.
      lastTokenRef.current = null;
      return;
    }
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
        (Constants.expoConfig as any)?.extra?.eas?.projectId ??
        mobileEnv.easProjectId;
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
      // Persisted so logout can unregister this device (see auth.tsx).
      await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, expoToken);
      if (__DEV__) {
        console.log("Push registration: token stored");
      }
      lastTokenRef.current = expoToken;
    };

    void register().catch((error) => {
      console.warn("Push registration failed", error);
    });
    // Re-attempt on foreground: if the user enables notifications in OS
    // Settings after denying, the earlier attempt bailed before storing a
    // token, and nothing else re-runs registration until restart/re-login.
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void register().catch((error) => {
        console.warn("Push registration failed", error);
      });
    });
    return () => {
      active = false;
      appStateSubscription.remove();
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
  tabBarChrome: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#edf0f2",
    shadowColor: "#15232b",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 6,
  },
  tabBarItem: {
    paddingTop: 0,
  },
  tabBarLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
    letterSpacing: -0.1,
  },
  navIconShell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconShellActive: {
    backgroundColor: "#0a8050",
    shadowColor: "#0a8050",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
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
