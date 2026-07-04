import { forwardRef, useState } from "react";
import {
  Pressable,
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
  clearable?: boolean;
}

export const TextInput = forwardRef<RNTextInput, AppTextInputProps>(function TextInput({
  label,
  error,
  helpText,
  containerStyle,
  style,
  variant = "signup",
  multiline,
  clearable = true,
  ...props
}, ref) {
  const [isFocused, setIsFocused] = useState(false);
  const value = typeof props.value === "string" ? props.value : "";
  const canClear = clearable && isFocused && !!props.onChangeText && !!value && props.editable !== false;

  return (
    <View style={[styles.container, variant === "embedded" && styles.containerEmbedded, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <RNTextInput
          ref={ref}
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
            canClear && styles.inputWithClear,
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
        {canClear ? (
          <Pressable
            accessibilityLabel="Clear input"
            hitSlop={10}
            onPress={() => props.onChangeText?.("")}
            style={[styles.clearButton, variant === "embedded" && styles.clearButtonEmbedded]}
          >
            <Text style={styles.clearButtonText}>×</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helpText ? <Text style={styles.helpText}>{helpText}</Text> : null}
    </View>
  );
});

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
  inputWrap: {
    justifyContent: "center",
    position: "relative",
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
  inputWithClear: {
    paddingRight: 34,
  },
  clearButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: spacing.sm,
    top: "50%",
    transform: [{ translateY: -22 }],
    width: 24,
  },
  clearButtonEmbedded: {
    right: 0,
  },
  clearButtonText: {
    color: colors.textSoft,
    fontSize: 20,
    lineHeight: 20,
  },
  helpText: {
    ...fields.helpText,
  },
  errorText: {
    ...fields.errorText,
  },
});
