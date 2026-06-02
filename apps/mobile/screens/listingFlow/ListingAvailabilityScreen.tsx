import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DatePicker from "../../components/AdaptiveDatePicker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Briefcase, Check, ChevronRight, Clock, SlidersHorizontal, X } from "lucide-react-native";
import { Button } from "../../components/ui";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { hostFlowColors } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";
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

function DayTimeReveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const progress = useState(() => new Animated.Value(visible ? 1 : 0))[0];
  const previousVisible = useRef(visible);

  useEffect(() => {
    if (previousVisible.current === visible) return;
    previousVisible.current = visible;
    progress.stopAnimation();
    progress.setValue(visible ? 0 : 1);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 360,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={{
        overflow: "hidden",
        opacity: progress,
        height: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 76],
        }),
        marginTop: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 8],
        }),
      }}
    >
      {children}
    </Animated.View>
  );
}

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
      if (exists) {
        return prev.filter((item) => item !== day);
      }

      setDayTimeRanges((currentRanges) => {
        const dayIndex = allDays.indexOf(day as DayCode);
        const previousSelectedDay =
          [...prev]
            .sort((a, b) => allDays.indexOf(a as DayCode) - allDays.indexOf(b as DayCode))
            .filter((selectedDay) => allDays.indexOf(selectedDay as DayCode) < dayIndex)
            .at(-1) ??
          prev.at(-1) ??
          null;

        if (!previousSelectedDay) {
          return currentRanges;
        }

        const previousRange = currentRanges[previousSelectedDay as DayCode];
        if (!previousRange) {
          return currentRanges;
        }

        return {
          ...currentRanges,
          [day]: {
            start: previousRange.start,
            end: previousRange.end,
          },
        };
      });

      return [...prev, day];
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Availability</Text>
        <StepProgress current={4} total={7} />
        <Text style={styles.title}>Set the availability for your space</Text>
        <Text style={styles.subtitle}>You can change this at any time</Text>

        <Pressable
          style={[styles.optionCard, styles.optionCardFirst, preset === "always" && styles.optionCardActive]}
          onPress={() => selectPreset("always")}
        >
          <View style={styles.optionRow}>
            <View style={[styles.optionIconBox, preset === "always" && styles.optionIconBoxActive]}>
              <Clock size={18} color={preset === "always" ? colors.accent : colors.textSoft} strokeWidth={2} />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Always available</Text>
              <Text style={styles.optionBody}>Mon – Sun · 24 hours · Recommended</Text>
            </View>
            {preset === "always" && <Check size={16} color={colors.accent} strokeWidth={2.8} />}
          </View>
        </Pressable>

        <Pressable
          style={[styles.optionCard, preset === "working" && styles.optionCardActive]}
          onPress={() => selectPreset("working")}
        >
          <View style={styles.optionRow}>
            <View style={[styles.optionIconBox, preset === "working" && styles.optionIconBoxActive]}>
              <Briefcase size={18} color={preset === "working" ? colors.accent : colors.textSoft} strokeWidth={2} />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Working week</Text>
              <Text style={styles.optionBody}>Mon – Fri · 06:00 – 19:00</Text>
            </View>
            {preset === "working" && <Check size={16} color={colors.accent} strokeWidth={2.8} />}
          </View>
        </Pressable>

        <Pressable
          style={[styles.optionCard, preset === "custom" && styles.optionCardActive]}
          onPress={() => selectPreset("custom")}
        >
          <View style={styles.optionRow}>
            <View style={[styles.optionIconBox, preset === "custom" && styles.optionIconBoxActive]}>
              <SlidersHorizontal size={18} color={preset === "custom" ? colors.accent : colors.textSoft} strokeWidth={2} />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Custom</Text>
              <Text style={styles.optionBody}>Choose your own days and times</Text>
            </View>
            {preset === "custom"
              ? <Check size={16} color={colors.accent} strokeWidth={2.8} />
              : <ChevronRight size={18} color={colors.textSoft} strokeWidth={2.4} />}
          </View>
        </Pressable>
        {preset === "custom" && weekdays.length ? (
          <View style={styles.customSummaryCard}>
            <Text style={styles.customSummaryLabel}>Selected schedule</Text>
            <Text style={styles.customSummary}>{availabilitySummary}</Text>
          </View>
        ) : null}
        {!timeWindowValid || !customWindowsValid ? (
          <Text style={styles.warningText}>End time must be after start time.</Text>
        ) : null}
      </ScrollView>
      <FlowFooter
        onBack={() => navigation.goBack()}
        primaryLabel="Continue"
        onPrimary={() => navigation.navigate("ListingPrice")}
        primaryDisabled={!canSave}
      />
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
                        <Pressable
                          accessibilityRole="switch"
                          accessibilityState={{ checked: enabled }}
                          onPress={() => toggleWeekday(day)}
                          style={[styles.dayToggleTrack, enabled && styles.dayToggleTrackActive]}
                        >
                          <View style={[styles.dayToggleKnob, enabled && styles.dayToggleKnobActive]} />
                        </Pressable>
                      </View>
                      <DayTimeReveal visible={enabled}>
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
                      </DayTimeReveal>
                    </View>
                  );
                })}
              </ScrollView>
              <Button
                title="Confirm"
                onPress={() => {
                  setPreset("custom");
                  setCustomVisible(false);
                }}
                disabled={weekdays.length === 0}
              />
            </View>
          </View>
        </Modal>
      ) : null}
      <DatePicker
        modal
        mode="time"
        open={pickerVisible}
        minuteInterval={5}
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
  kicker: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 35,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800",
    marginTop: 14,
    letterSpacing: -1.0,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontFamily: "PlusJakartaSans-Regular",
    marginTop: 6,
    lineHeight: 23,
  },
  optionCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  optionCardFirst: {
    marginTop: 24,
  },
  optionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconBoxActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionTextWrap: {
    flex: 1,
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
    color: colors.text,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-SemiBold",
    lineHeight: 22,
    marginTop: 4,
  },
  customSummaryCard: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  customSummaryLabel: {
    color: colors.accent,
    fontSize: 11,
    fontFamily: "PlusJakartaSans-Bold",
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  optionCardActive: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: colors.accentSoft,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  optionBody: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: "PlusJakartaSans-Regular",
    marginTop: 2,
    lineHeight: 20,
  },
  inlineRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  timePill: {
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timePillLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "PlusJakartaSans-Bold",
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  timePillValue: {
    color: colors.text,
    fontSize: 16,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800",
    marginTop: 3,
    letterSpacing: -0.3,
  },
  warningText: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    marginTop: 10,
  },
  footer: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 10,
    paddingBottom: 2,
  },
  continueButton: {
    flex: 1,
    borderRadius: 16,
    minHeight: 48,
  },
  continueButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "92%",
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.screenX,
    paddingTop: 14,
    paddingBottom: 14,
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
    fontSize: 20,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800",
    paddingHorizontal: 8,
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-Regular",
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 6,
  },
  dayList: {
    paddingBottom: 10,
  },
  dayRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayBlock: {
    marginTop: 10,
  },
  dayTimeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 2,
  },
  dayLabel: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "PlusJakartaSans-Bold",
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  dayToggleTrack: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 22,
    padding: 2,
    width: 40,
  },
  dayToggleTrackActive: {
    backgroundColor: colors.accent,
  },
  dayToggleKnob: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    height: 18,
    width: 18,
  },
  dayToggleKnobActive: {
    marginLeft: 18,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    alignItems: 'center',
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: hostFlowColors.textMuted,
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 15,
    fontWeight: '600',
  },
});
