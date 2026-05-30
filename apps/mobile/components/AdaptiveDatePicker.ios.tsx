import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { AdaptiveDatePickerProps } from "./AdaptiveDatePicker";

function pickerModeLabel(mode: "time" | "datetime") {
  return mode === "time" ? "Select time" : "Select date and time";
}

export default function AdaptiveDatePicker(props: AdaptiveDatePickerProps) {
  if (props.modal) {
    return <ModalAdaptiveDatePicker {...props} />;
  }

  return (
    <DateTimePicker
      value={props.date}
      mode={props.mode}
      display="spinner"
      minimumDate={props.minimumDate}
      minuteInterval={props.minuteInterval}
      onChange={(_, value) => {
        if (value) props.onDateChange(value);
      }}
      style={styles.inlinePicker}
      themeVariant="light"
    />
  );
}

function ModalAdaptiveDatePicker({
  open,
  date,
  mode,
  minimumDate,
  minuteInterval,
  onConfirm,
  onCancel,
}: Extract<AdaptiveDatePickerProps, { modal: true }>) {
  const [draftDate, setDraftDate] = useState(date);

  useEffect(() => {
    if (open) {
      setDraftDate(date);
    }
  }, [date, open]);

  if (!open) return null;

  return (
    <Modal transparent animationType="fade" visible={open} onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>{pickerModeLabel(mode)}</Text>
          <DateTimePicker
            value={draftDate}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate}
            minuteInterval={minuteInterval}
            onChange={(_, value) => {
              if (value) setDraftDate(value);
            }}
            style={styles.modalPicker}
            themeVariant="light"
          />
          <View style={styles.actions}>
            <Pressable style={styles.actionGhost} onPress={onCancel}>
              <Text style={styles.actionGhostText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.actionPrimary} onPress={() => onConfirm(draftDate)}>
              <Text style={styles.actionPrimaryText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlinePicker: {
    alignSelf: "stretch",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  modalPicker: {
    alignSelf: "stretch",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  actionGhost: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionGhostText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans-Medium",
    color: "#475569",
  },
  actionPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#0fa968",
  },
  actionPrimaryText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: "#FFFFFF",
  },
});
