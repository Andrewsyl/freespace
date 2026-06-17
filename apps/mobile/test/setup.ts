import "@testing-library/jest-native/extend-expect";
import { Animated } from "react-native";

process.env.EXPO_PUBLIC_API_BASE ??= "http://127.0.0.1:4000";
process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??= "pk_test_mock";

// Neutralize Animated.spring in tests. Several components fire native-driver
// springs on press/mount (often with no completion callback). When userEvent
// drives the full press sequence, those springs race the act() environment and
// can hang to the Jest timeout on slower CI runners (passes locally). We only
// override spring — timing is left intact because its completion callbacks
// drive state and must run normally.
const noopAnimation = () =>
  ({
    start: (callback?: (result: { finished: boolean }) => void) =>
      callback?.({ finished: true }),
    stop: () => {},
    reset: () => {},
  }) as unknown as Animated.CompositeAnimation;

jest.spyOn(Animated, "spring").mockImplementation(noopAnimation as never);

jest.mock(
  "react-native/Libraries/Animated/NativeAnimatedHelper",
  () => require("react-native/src/private/animated/NativeAnimatedHelper"),
  { virtual: true }
);

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const View = require("react-native").View;
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (Component: unknown) => Component,
    },
    createAnimatedComponent: (Component: unknown) => Component,
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (updater: () => Record<string, unknown>) => updater(),
    withSpring: (value: unknown) => value,
  };
});

jest.mock("@react-navigation/native", () => {
  const React = require("react");
  const actual = jest.requireActual("@react-navigation/native");
  return {
    ...actual,
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, []);
    },
    useIsFocused: () => true,
  };
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Mock = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  return {
    __esModule: true,
    default: Mock,
    Marker: Mock,
    Callout: Mock,
    PROVIDER_GOOGLE: "google",
  };
});

jest.mock("lottie-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
});

jest.mock("react-native-figma-squircle", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SquircleView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
  impactAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    hasPlayServices: jest.fn(),
  },
  statusCodes: {},
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name?: string }) => React.createElement(Text, null, name ?? "icon");
  return { MaterialIcons: Icon, Ionicons: Icon };
});

jest.mock("@stripe/stripe-react-native", () => ({
  useStripe: () => ({
    initPaymentSheet: jest.fn().mockResolvedValue({}),
    presentPaymentSheet: jest.fn().mockResolvedValue({}),
  }),
  StripeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({
    granted: true,
    canAskAgain: true,
    status: "granted",
  }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({
    granted: true,
    canAskAgain: true,
    status: "granted",
  }),
  SchedulableTriggerInputTypes: {
    DATE: "date",
  },
  scheduleNotificationAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 53.3498, longitude: -6.2603 },
  }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([]),
}));

jest.mock("react-native-date-picker", () => {
  const React = require("react");
  const { View } = require("react-native");
  return ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
});

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { View } = require("react-native");
  return ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
});
