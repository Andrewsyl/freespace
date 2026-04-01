import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { colors, spacing, textStyles } from "../../styles/theme";

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helpText?: string;
  containerStyle?: ViewStyle;
  variant?: "signup" | "embedded";
}

export function TextInput({
  label,
  error,
  helpText,
  containerStyle,
  style,
  variant = "signup",
  multiline,
  ...props
}: AppTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, variant === "embedded" && styles.containerEmbedded, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <RNTextInput
        {...props}
        multiline={multiline}
        style={[
          styles.input,
          variant === "embedded" ? styles.inputEmbedded : styles.inputSignup,
          multiline && styles.inputMultiline,
          isFocused && (variant === "embedded" ? styles.inputEmbeddedFocused : styles.inputFocused),
          error && styles.inputError,
          style,
        ]}
        onFocus={(event) => {
          setIsFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          props.onBlur?.(event);
        }}
        placeholderTextColor={colors.textSoft}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helpText ? <Text style={styles.helpText}>{helpText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  containerEmbedded: {
    marginBottom: 0,
  },
  label: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter-Medium",
    fontWeight: "500",
    marginBottom: spacing.xs,
  },
  input: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Inter-Regular",
    fontWeight: "400",
  },
  inputSignup: {
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  inputEmbedded: {
    backgroundColor: "transparent",
    borderWidth: 0,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  inputFocused: {
    borderBottomColor: colors.accent,
  },
  inputEmbeddedFocused: {
    borderBottomColor: "transparent",
  },
  inputError: {
    borderBottomColor: colors.danger,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  helpText: {
    ...textStyles.meta,
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
  errorText: {
    ...textStyles.meta,
    color: colors.danger,
    marginTop: spacing.xxs,
  },
});
