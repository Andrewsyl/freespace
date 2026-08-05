module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  // The first render() in a suite absorbs the one-off cost of babel-transforming
  // the React Native / Expo module graph, which on a cold cache is ~6x the cost
  // of the same render warm. On CI that lands the first test of a file right on
  // jest's 5s default and it fails there while every later test in the same file
  // takes ~200ms (this red-lined CI from 2026-07-13). The tests aren't hanging —
  // they're paying a fixed startup cost — so the ceiling is raised rather than
  // the assertions loosened.
  testTimeout: 30000,
  testMatch: ["<rootDir>/test/**/*.test.{ts,tsx}"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|@react-navigation/.*|@expo/.*|expo(nent)?|expo-.*|expo-modules-core|@expo-google-fonts/.*|@miblanchard/react-native-slider|react-native-.*|@stripe/stripe-react-native|lottie-react-native)/)",
  ],
};
