import { Platform } from "react-native";
import AndroidAdaptiveDatePicker from "./AdaptiveDatePicker.android";
import IOSAdaptiveDatePicker from "./AdaptiveDatePicker.ios";

export type AdaptiveDatePickerProps =
  | {
      modal?: false;
      date: Date;
      mode: "time" | "datetime";
      minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
      minimumDate?: Date;
      onDateChange: (date: Date) => void;
    }
  | {
      modal: true;
      open: boolean;
      date: Date;
      mode: "time" | "datetime";
      minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
      minimumDate?: Date;
      onConfirm: (date: Date) => void;
      onCancel: () => void;
    };

export default function AdaptiveDatePicker(props: AdaptiveDatePickerProps) {
  if (Platform.OS === "ios") {
    return <IOSAdaptiveDatePicker {...props} />;
  }
  return <AndroidAdaptiveDatePicker {...props} />;
}
