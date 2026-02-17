import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import DatePicker from "react-native-date-picker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, X } from "lucide-react-native";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { cardShadow, colors, radius, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingAvailability: undefined;
  ListingPrice: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingAvailability">;

type PickerField = "timeStart" | "timeEnd";
type DayCode = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type DayTimeRanges = Record<DayCode, { start: string; end: string }>;

type AvailabilityPreset = "always" | "working" | "custom";

export function ListingAvailabilityScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const insets = useSafeAreaInsets();
  const allDays: DayCode[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [timeStart, setTimeStart] = useState(() =>
    draft.availability.timeStart
      ? new Date(draft.availability.timeStart)
      : new Date(new Date().setHours(0, 0, 0, 0))
  );
  const [timeEnd, setTimeEnd] = useState(() => {
    if (draft.availability.timeEnd) return new Date(draft.availability.timeEnd);
    return new Date(new Date().setHours(23, 59, 0, 0));
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<PickerField>("timeStart");
  const [pickerDay, setPickerDay] = useState<DayCode | null>(null);
  const [weekdays, setWeekdays] = useState<string[]>(
    draft.availability.weekdays.length ? draft.availability.weekdays : []
  );
  const [dayTimeRanges, setDayTimeRanges] = useState<DayTimeRanges>(() => {
    const now = new Date();
    const fallbackStart = draft.availability.timeStart
      ? new Date(draft.availability.timeStart)
      : new Date(new Date().setHours(6, 0, 0, 0));
    const fallbackEnd = draft.availability.timeEnd
      ? new Date(draft.availability.timeEnd)
      : new Date(new Date().setHours(19, 0, 0, 0));
    const source = draft.availability.dayTimeRanges ?? {};
    const out = {} as DayTimeRanges;
    allDays.forEach((day) => {
      const start = source[day]?.start ? new Date(source[day].start) : fallbackStart;
      const end = source[day]?.end ? new Date(source[day].end) : fallbackEnd;
      const startForDay = new Date(now);
      startForDay.setHours(start.getHours(), start.getMinutes(), 0, 0);
      const endForDay = new Date(now);
      endForDay.setHours(end.getHours(), end.getMinutes(), 0, 0);
      out[day] = { start: startForDay.toISOString(), end: endForDay.toISOString() };
    });
    return out;
  });
  const [customVisible, setCustomVisible] = useState(false);
  const [preset, setPreset] = useState<AvailabilityPreset>(() => {
    const startHour = timeStart.getHours();
    const startMinute = timeStart.getMinutes();
    const endHour = timeEnd.getHours();
    const endMinute = timeEnd.getMinutes();
    const sorted = [...weekdays].sort().join(",");
    const allSorted = [...allDays].sort().join(",");
    const workSorted = ["Mon", "Tue", "Wed", "Thu", "Fri"].sort().join(",");
    if (sorted === allSorted && startHour === 0 && startMinute === 0 && endHour === 23 && endMinute === 59) {
      return "always";
    }
    if (sorted === workSorted && startHour === 6 && startMinute === 0 && endHour === 19 && endMinute === 0) {
      return "working";
    }
    return "custom";
  });

  const formatTime = (value: Date) =>
    value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDays = (days: string[]) => (days.length ? days.join(", ") : "");

  const availabilitySummary = useMemo(() => {
    if (preset === "always") return "Monday - Sunday (24 hours)";
    if (preset === "working") return "Monday - Friday (06:00 - 19:00)";
    if (!weekdays.length) return "";
    const details = weekdays
      .map((day) => {
        const code = day as DayCode;
        const range = dayTimeRanges[code];
        if (!range) return null;
        return `${day} ${formatTime(new Date(range.start))}-${formatTime(new Date(range.end))}`;
      })
      .filter(Boolean)
      .join(" • ");
    return details || `${formatDays(weekdays)} (${formatTime(timeStart)} - ${formatTime(timeEnd)})`;
  }, [dayTimeRanges, preset, timeEnd, timeStart, weekdays]);

  const timeWindowValid = useMemo(() => {
    const startMinutes = timeStart.getHours() * 60 + timeStart.getMinutes();
    const endMinutes = timeEnd.getHours() * 60 + timeEnd.getMinutes();
    return endMinutes > startMinutes;
  }, [timeEnd, timeStart]);
  const customWindowsValid = useMemo(() => {
    if (preset !== "custom") return true;
    return weekdays.every((day) => {
      const code = day as DayCode;
      const range = dayTimeRanges[code];
      if (!range) return false;
      const start = new Date(range.start);
      const end = new Date(range.end);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      return endMinutes > startMinutes;
    });
  }, [dayTimeRanges, preset, weekdays]);

  useEffect(() => {
    if (!availabilitySummary) return;
    setDraft((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        mode: preset === "always" ? "daily" : "recurring",
        detail: availabilitySummary,
        timeStart: timeStart.toISOString(),
        timeEnd: timeEnd.toISOString(),
        dateStart: prev.availability.dateStart,
        dateEnd: prev.availability.dateEnd,
        weekdays,
        dayTimeRanges,
      },
    }));
  }, [availabilitySummary, dayTimeRanges, preset, setDraft, timeEnd, timeStart, weekdays]);

  const canContinue = preset !== "custom" || weekdays.length > 0;
  const canSave = canContinue && timeWindowValid && customWindowsValid;

  const openPicker = (field: PickerField, day: DayCode | null = null) => {
    setPickerField(field);
    setPickerDay(day);
    setPickerVisible(true);
  };

  const handlePickerConfirm = (value: Date) => {
    if (pickerDay) {
      setDayTimeRanges((prev) => {
        const current = prev[pickerDay];
        if (!current) return prev;
        const startDate = new Date(current.start);
        const endDate = new Date(current.end);
        const next = { ...prev };
        if (pickerField === "timeStart") {
          startDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
          next[pickerDay] = { ...current, start: startDate.toISOString() };
        } else {
          endDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
          next[pickerDay] = { ...current, end: endDate.toISOString() };
        }
        return next;
      });
      return;
    }
    if (pickerField === "timeStart") {
      setTimeStart(value);
    } else {
      setTimeEnd(value);
    }
  };

  const toggleWeekday = (day: string) => {
    setWeekdays((prev) => {
      const exists = prev.includes(day);
      const next = exists ? prev.filter((item) => item !== day) : [...prev, day];
      return next;
    });
  };

  const selectPreset = (next: AvailabilityPreset) => {
    const previousPreset = preset;
    setPreset(next);
    if (next === "always") {
      const start = new Date(timeStart);
      const end = new Date(timeEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 0, 0);
      setTimeStart(start);
      setTimeEnd(end);
      setWeekdays(allDays);
      setDayTimeRanges((prev) => {
        const nextRanges = { ...prev };
        allDays.forEach((day) => {
          const s = new Date(start);
          const e = new Date(end);
          nextRanges[day] = { start: s.toISOString(), end: e.toISOString() };
        });
        return nextRanges;
      });
      return;
    }
    if (next === "working") {
      const start = new Date(timeStart);
      const end = new Date(timeEnd);
      start.setHours(6, 0, 0, 0);
      end.setHours(19, 0, 0, 0);
      setTimeStart(start);
      setTimeEnd(end);
      setWeekdays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
      setDayTimeRanges((prev) => {
        const nextRanges = { ...prev };
        ["Mon", "Tue", "Wed", "Thu", "Fri"].forEach((day) => {
          const s = new Date(start);
          const e = new Date(end);
          nextRanges[day as DayCode] = { start: s.toISOString(), end: e.toISOString() };
        });
        return nextRanges;
      });
      return;
    }
    if (previousPreset !== "custom") {
      setWeekdays([]);
    }
    setCustomVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Availability</Text>
        <StepProgress current={4} total={7} />
        <Text style={styles.title}>Set the availability for your space</Text>
        <Text style={styles.subtitle}>You can change this at any time</Text>

        <Pressable
          style={[styles.optionCard, preset === "always" && styles.optionCardActive]}
          onPress={() => selectPreset("always")}
        >
          <Text style={styles.optionTitle}>Always available (Recommended)</Text>
          <Text style={styles.optionBody}>Monday - Sunday (24 hours)</Text>
        </Pressable>

        <Pressable
          style={[styles.optionCard, preset === "working" && styles.optionCardActive]}
          onPress={() => selectPreset("working")}
        >
          <Text style={styles.optionTitle}>Working week</Text>
          <Text style={styles.optionBody}>Monday - Friday (06:00 - 19:00)</Text>
        </Pressable>

        <Pressable
          style={[styles.optionCard, preset === "custom" && styles.optionCardActive]}
          onPress={() => selectPreset("custom")}
        >
          <View style={styles.customRow}>
            <View style={styles.customText}>
              <Text style={styles.optionTitle}>Custom</Text>
              <Text style={styles.optionBody}>Personalised settings</Text>
            </View>
            <ChevronRight size={18} color={colors.textSoft} strokeWidth={2.4} />
          </View>
        </Pressable>
        {preset === "custom" && weekdays.length ? (
          <Text style={styles.customSummary}>Selected: {availabilitySummary}</Text>
        ) : null}
        {!timeWindowValid || !customWindowsValid ? (
          <Text style={styles.warningText}>End time must be after start time.</Text>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingPrice")}
          disabled={!canSave}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
      {customVisible ? (
        <Modal animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setCustomVisible(false)} style={styles.iconButton}>
                  <X size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.modalTitle}>Set your custom availability</Text>
                <View style={styles.iconButton} />
              </View>
              <Text style={styles.modalSubtitle}>
                Choose the days and times that you would like to make your space available.
              </Text>
              <ScrollView contentContainerStyle={styles.dayList}>
                {allDays.map((day) => {
                  const enabled = weekdays.includes(day);
                  return (
                    <View key={day} style={styles.dayBlock}>
                      <View style={styles.dayRow}>
                        <Text style={styles.dayLabel}>
                          {{
                            Mon: "Monday",
                            Tue: "Tuesday",
                            Wed: "Wednesday",
                            Thu: "Thursday",
                            Fri: "Friday",
                            Sat: "Saturday",
                            Sun: "Sunday",
                          }[day]}
                        </Text>
                        <Switch
                          value={enabled}
                          onValueChange={() => toggleWeekday(day)}
                          trackColor={{ false: "#E5E7EB", true: "#9FE3B0" }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                      {enabled ? (
                        <View style={styles.dayTimeRow}>
                          <Pressable style={styles.timePill} onPress={() => openPicker("timeStart", day)}>
                            <Text style={styles.timePillLabel}>Start</Text>
                            <Text style={styles.timePillValue}>
                              {formatTime(new Date(dayTimeRanges[day].start))}
                            </Text>
                          </Pressable>
                          <Pressable style={styles.timePill} onPress={() => openPicker("timeEnd", day)}>
                            <Text style={styles.timePillLabel}>End</Text>
                            <Text style={styles.timePillValue}>
                              {formatTime(new Date(dayTimeRanges[day].end))}
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
              <Pressable
                style={[styles.primaryButton, weekdays.length === 0 && styles.primaryButtonDisabled]}
                onPress={() => {
                  setPreset("custom");
                  setCustomVisible(false);
                }}
                disabled={weekdays.length === 0}
              >
                <Text style={styles.primaryButtonText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
      <DatePicker
        modal
        mode="time"
        open={pickerVisible}
        minuteInterval={30}
        date={
          pickerDay
            ? new Date(
                pickerField === "timeStart"
                  ? dayTimeRanges[pickerDay].start
                  : dayTimeRanges[pickerDay].end
              )
            : pickerField === "timeStart"
              ? timeStart
              : timeEnd
        }
        onConfirm={(value) => {
          setPickerVisible(false);
          handlePickerConfirm(value);
          setPickerDay(null);
        }}
        onCancel={() => {
          setPickerVisible(false);
          setPickerDay(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    padding: spacing.screenX,
    paddingBottom: 140,
    paddingTop: 0,
  },
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    marginTop: 6,
    lineHeight: 20,
  },
  optionCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
    ...cardShadow,
  },
  customRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  customText: {
    flex: 1,
  },
  customSummary: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    marginTop: 8,
    marginHorizontal: 4,
  },
  optionCardActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
  },
  optionBody: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    marginTop: 6,
    lineHeight: 18,
  },
  inlineRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  timePill: {
    backgroundColor: colors.appBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timePillLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  timePillValue: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
    marginTop: 6,
  },
  warningText: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
    marginTop: 10,
  },
  footer: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    minHeight: 44,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "92%",
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.screenX,
    paddingTop: 14,
    paddingBottom: 18,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.text,
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
    paddingHorizontal: 8,
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    marginTop: 12,
    lineHeight: 20,
    marginBottom: 8,
  },
  dayList: {
    paddingBottom: 14,
  },
  dayRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayBlock: {
    marginTop: 10,
  },
  dayTimeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  dayLabel: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "Poppins-Regular",
  },
});
