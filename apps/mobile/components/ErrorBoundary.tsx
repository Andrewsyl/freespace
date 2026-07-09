import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius } from "../styles/theme";
import { captureException } from "../sentry";
import { logError } from "../logger";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

// Top-level safety net: any uncaught error thrown while rendering the tree is
// caught here so users get a branded "try again" screen instead of a blank/dead
// app, and the error is forwarded to Sentry for grouping + alerting.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureException(error, { componentStack: info.componentStack ?? "" });
    logError("ErrorBoundary caught render error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected error. You can try again — if it keeps happening,
          restart the app.
        </Text>
        <Pressable
          style={styles.button}
          onPress={this.handleReset}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    color: "#0F172A",
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#0a8050",
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});
