import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { spacing, surfaces } from "../../styles/theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
  muted?: boolean;
}

export function Card({ children, style, noPadding = false, muted = false }: CardProps) {
  return (
    <View style={[styles.card, muted ? styles.cardMuted : styles.cardDefault, noPadding && styles.noPadding, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.card,
  },
  cardDefault: {
    ...surfaces.card,
  },
  cardMuted: {
    ...surfaces.cardMuted,
  },
  noPadding: {
    padding: 0,
  },
});
