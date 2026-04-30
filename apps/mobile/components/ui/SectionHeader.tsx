import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, spacing, textStyles } from "../../styles/theme";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  style?: ViewStyle;
}

export function SectionHeader({ title, subtitle, trailing, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...textStyles.sectionTitle,
    color: colors.text,
  },
  subtitle: {
    ...textStyles.sectionIntro,
    color: colors.textMuted,
  },
});
