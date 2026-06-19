import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "../../styles/theme";

type BackButtonProps = {
  onPress: () => void;
  style?: ViewStyle;
};

export function BackButton({ onPress, style }: BackButtonProps) {
  return (
    <Pressable style={[styles.button, style]} onPress={onPress}>
      <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    width: 34,
    elevation: 4,
  },
});
