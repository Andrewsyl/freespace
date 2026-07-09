import React from "react";
import { ViewStyle } from "react-native";
import { BookButton } from "./BookButton";

interface SquircleBtnProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

// The CTA visual now lives in BookButton (flat filled-green pill) so every
// primary button shares one look. This alias keeps existing call sites working;
// prefer importing BookButton directly in new code.
export function SquircleBtn(props: SquircleBtnProps) {
  return <BookButton {...props} />;
}
