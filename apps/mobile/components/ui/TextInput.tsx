import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { colors, fields } from "../../styles/theme";

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helpText?: string;
  containerStyle?: ViewStyle;
}

export function TextInput({
  label,
  error,
  helpText,
  containerStyle,
  style,
  ...props
}: AppTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <RNTextInput
        {...props}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
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
        placeholderTextColor={fields.placeholderTextColor}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helpText ? <Text style={styles.helpText}>{helpText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...fields.container,
  },
  label: {
    ...fields.label,
  },
  input: {
    ...fields.input,
    ...fields.inputText,
  },
  inputFocused: {
    ...fields.inputFocused,
  },
  inputError: {
    ...fields.inputError,
  },
  helpText: {
    ...fields.helpText,
  },
  errorText: {
    ...fields.errorText,
  },
});
