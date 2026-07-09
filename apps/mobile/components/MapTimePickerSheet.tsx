import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius } from "../styles/theme";
import DatePicker from "./AdaptiveDatePicker";
import { DrumRollPicker } from "./DrumRollPicker";

type MapTimePickerSheetProps = {
  visible: boolean;
  field: "start" | "end";
  value: Date;
  /** The chosen arrival time — shown as a hint on the departure picker. */
  startAt?: Date;
  minimumDate?: Date;
  minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
  /** Pick a calendar day only (no hour/minute) — e.g. a monthly start date. */
  dateOnly?: boolean;
  /** Override the sheet heading (defaults to Arrival/Departure time). */
  title?: string;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
};

function formatTimeLabel(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// The same time picker used on the map/search page: a drum-roll wheel sheet on
// Android and the platform date picker on iOS.
export function MapTimePickerSheet({
  visible,
  field,
  value,
  startAt,
  minimumDate,
  minuteInterval = 5,
  dateOnly = false,
  title,
  onCancel,
  onConfirm,
}: MapTimePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const sheetAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      setDraftDate(value);
      sheetAnim.setValue(400);
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (Platform.OS === "web") return null;

  const current = draftDate ?? value;

  if (Platform.OS !== "android") {
    return (
      <DatePicker
        modal
        open={visible}
        date={current}
        mode={dateOnly ? "date" : "datetime"}
        minuteInterval={minuteInterval}
        minimumDate={minimumDate}
        onConfirm={(date) => onConfirm(date)}
        onCancel={onCancel}
      />
    );
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onCancel} />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(24, insets.bottom + 12), transform: [{ translateY: sheetAnim }] },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{title ?? (field === "start" ? "Arrival time" : "Departure time")}</Text>
            {field === "end" && startAt ? (
              <Text style={styles.subtitle}>arriving {formatTimeLabel(startAt)}</Text>
            ) : null}
          </View>

          <DrumRollPicker
            date={current}
            minuteInterval={minuteInterval}
            dateOnly={dateOnly}
            onChange={(date) => setDraftDate(date)}
          />

          <View style={styles.footer}>
            <Pressable style={styles.backBtn} onPress={onCancel}>
              <Text style={styles.backBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primary, pressed && { opacity: 0.88 }]}
              onPress={() => onConfirm(current)}
            >
              <Text style={styles.primaryText}>Done</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "#D1D5DB",
    borderRadius: 99,
    height: 4,
    marginBottom: 12,
    width: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: "#111827",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  backBtn: {
    alignItems: "center",
    borderColor: "#E5E7EB",
    borderRadius: 14,
    borderWidth: 1.5,
    flex: 1,
    height: 52,
    justifyContent: "center",
  },
  backBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: "#374151",
    letterSpacing: -0.2,
  },
  primary: {
    alignItems: "center",
    backgroundColor: "#0a8050",
    borderRadius: radius.pill,
    flex: 2,
    height: 52,
    justifyContent: "center",
    shadowColor: "#0a7a50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  primaryText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
});
