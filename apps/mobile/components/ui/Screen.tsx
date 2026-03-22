import React from "react";
import { ScrollView, ScrollViewProps, StyleSheet, View, ViewProps } from "react-native";
import { spacing, surfaces } from "../../styles/theme";

type ScreenProps = ViewProps & {
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
};

export function Screen({ children, style, scroll = false, scrollProps, ...props }: ScreenProps) {
  if (scroll) {
    return (
      <ScrollView
        {...scrollProps}
        style={[styles.screen, style]}
        contentContainerStyle={[styles.scrollContent, scrollProps?.contentContainerStyle]}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View {...props} style={[styles.screen, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...surfaces.screen,
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenY,
    paddingBottom: spacing.xl,
  },
});
