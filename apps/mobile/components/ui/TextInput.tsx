import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { colors, fields, spacing } from "../../styles/theme";

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helpText?: string;
  containerStyle?: ViewStyle;
  variant?: "signup" | "form" | "embedded";
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
          variant === "form" ? styles.inputFormText : styles.input,
          variant === "embedded"
            ? styles.inputEmbedded
            : variant === "form"
              ? styles.inputForm
              : styles.inputSignup,
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
    ...fields.label,
  },
  input: {
    ...fields.inputText,
  },
  inputFormText: {
    ...fields.inputNeutralText,
  },
  inputSignup: {
    ...fields.input,
  },
  inputForm: {
    ...fields.inputNeutral,
  },
  inputEmbedded: {
    backgroundColor: "transparent",
    borderWidth: 0,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  inputFocused: {
    ...fields.inputFocused,
  },
  inputEmbeddedFocused: {
    borderBottomColor: "transparent",
  },
  inputError: {
    ...fields.inputError,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  helpText: {
    ...fields.helpText,
  },
  errorText: {
    ...fields.errorText,
  },
});
