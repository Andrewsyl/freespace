import DatePicker from "react-native-date-picker";
import type { AdaptiveDatePickerProps } from "./AdaptiveDatePicker";

export default function AdaptiveDatePicker(props: AdaptiveDatePickerProps) {
  return <DatePicker {...props} />;
}
