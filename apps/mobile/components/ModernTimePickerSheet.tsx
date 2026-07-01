import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type QuickTimeOption = {
  label: string;
  value: Date;
};

type ModernTimePickerSheetProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  value: Date;
  minimumDate?: Date;
  minuteInterval?: number;
  quickOptions?: QuickTimeOption[];
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: Date) => void;
};

type WheelOption = {
  key: string;
  label: string;
  disabled?: boolean;
};

const ITEM_HEIGHT = 46;
const VISIBLE_ITEMS = 5;
const WHEEL_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);
const DAY_OPTION_COUNT = 91;
const HOURS = Array.from({ length: 24 }, (_, index) => index);

export function ModernTimePickerSheet({
  visible,
  title,
  subtitle,
  value,
  minimumDate,
  minuteInterval = 5,
  quickOptions = [],
  confirmLabel = "Use time",
  onCancel,
  onConfirm,
}: ModernTimePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => normalisePickerValue(value, minimumDate, minuteInterval));

  useEffect(() => {
    if (visible) {
      setDraft(normalisePickerValue(value, minimumDate, minuteInterval));
    }
  }, [minimumDate, minuteInterval, value, visible]);

  const dayOptions = useMemo(() => {
    const minStart = startOfDay(minimumDate ?? new Date());
    const selectedStart = startOfDay(draft);
    const selectedOffset = daysBetween(minStart, selectedStart);
    const firstDay = selectedOffset >= DAY_OPTION_COUNT
      ? selectedStart
      : minStart;

    return Array.from({ length: DAY_OPTION_COUNT }, (_, index) => addDays(firstDay, index));
  }, [draft, minimumDate]);

  const minuteOptions = useMemo(
    () => Array.from({ length: Math.floor(60 / minuteInterval) }, (_, index) => index * minuteInterval),
    [minuteInterval]
  );

  const selectedDayIndex = Math.max(
    0,
    dayOptions.findIndex((day) => isSameDay(day, draft))
  );
  const selectedHourIndex = draft.getHours();
  const selectedMinuteIndex = Math.max(
    0,
    minuteOptions.findIndex((minute) => minute === draft.getMinutes())
  );

  const dateWheelOptions = useMemo(
    () => dayOptions.map((day) => ({
      key: day.toISOString(),
      label: formatWheelDay(day),
    })),
    [dayOptions]
  );

  const hourWheelOptions = useMemo(
    () => HOURS.map((hour) => ({
      key: String(hour),
      label: String(hour).padStart(2, "0"),
      disabled: wouldBeBeforeMinimum(draft, minimumDate, hour, draft.getMinutes()),
    })),
    [draft, minimumDate]
  );

  const minuteWheelOptions = useMemo(
    () => minuteOptions.map((minute) => ({
      key: String(minute),
      label: String(minute).padStart(2, "0"),
      disabled: wouldBeBeforeMinimum(draft, minimumDate, draft.getHours(), minute),
    })),
    [draft, minimumDate, minuteOptions]
  );

  const setDayIndex = useCallback((index: number) => {
    const day = dayOptions[index];
    if (!day) return;
    const next = new Date(draft);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    setDraft(normalisePickerValue(next, minimumDate, minuteInterval));
  }, [dayOptions, draft, minimumDate, minuteInterval]);

  const setHourIndex = useCallback((index: number) => {
    const hour = HOURS[index];
    if (hour === undefined) return;
    const next = new Date(draft);
    next.setHours(hour, draft.getMinutes(), 0, 0);
    setDraft(normalisePickerValue(next, minimumDate, minuteInterval));
  }, [draft, minimumDate, minuteInterval]);

  const setMinuteIndex = useCallback((index: number) => {
    const minute = minuteOptions[index];
    if (minute === undefined) return;
    const next = new Date(draft);
    next.setMinutes(minute, 0, 0);
    setDraft(normalisePickerValue(next, minimumDate, minuteInterval));
  }, [draft, minimumDate, minuteInterval, minuteOptions]);

  const chooseQuickOption = useCallback((option: QuickTimeOption) => {
    setDraft(normalisePickerValue(option.value, minimumDate, minuteInterval));
  }, [minimumDate, minuteInterval]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 14) }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            {title ? (
              <>
                <Text style={styles.kicker}>Set time</Text>
                <Text style={styles.title}>{title}</Text>
              </>
            ) : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <Text style={styles.summary}>{formatSummary(draft)}</Text>
          </View>

          {quickOptions.length > 0 ? (
            <View style={styles.quickRow}>
              {quickOptions.map((option) => {
                const normalised = normalisePickerValue(option.value, minimumDate, minuteInterval);
                const active = sameMinute(draft, normalised);
                return (
                  <Pressable
                    key={`${option.label}-${option.value.toISOString()}`}
                    style={[styles.quickPill, active && styles.quickPillActive]}
                    onPress={() => chooseQuickOption(option)}
                  >
                    <Text style={[styles.quickText, active && styles.quickTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.wheelCard}>
            <View style={styles.selectionBand} pointerEvents="none" />
            <WheelColumn
              options={dateWheelOptions}
              selectedIndex={selectedDayIndex}
              onSelectIndex={setDayIndex}
              flex={1.85}
            />
            <View style={styles.columnDivider} />
            <WheelColumn
              options={hourWheelOptions}
              selectedIndex={selectedHourIndex}
              onSelectIndex={setHourIndex}
            />
            <Text style={styles.timeSeparator}>:</Text>
            <WheelColumn
              options={minuteWheelOptions}
              selectedIndex={selectedMinuteIndex}
              onSelectIndex={setMinuteIndex}
            />
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={() => onConfirm(draft)}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function WheelColumn({
  options,
  selectedIndex,
  onSelectIndex,
  flex = 1,
}: {
  options: WheelOption[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  flex?: number;
}) {
  const listRef = useRef<FlatList<WheelOption>>(null);
  const selectedIndexRef = useRef(selectedIndex);
  const momentumActiveRef = useRef(false);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: Math.max(0, selectedIndex) * ITEM_HEIGHT,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedIndex, options.length]);

  useEffect(() => () => {
    if (dragEndTimerRef.current) {
      clearTimeout(dragEndTimerRef.current);
    }
  }, []);

  const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawIndex = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const index = clamp(rawIndex, 0, options.length - 1);
    const enabledIndex = nearestEnabledIndex(options, index);

    if (enabledIndex !== index) {
      listRef.current?.scrollToOffset({
        offset: enabledIndex * ITEM_HEIGHT,
        animated: true,
      });
    }

    if (enabledIndex !== selectedIndexRef.current) {
      selectedIndexRef.current = enabledIndex;
      onSelectIndex(enabledIndex);
    }
  }, [onSelectIndex, options]);

  const handleDragEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (dragEndTimerRef.current) {
      clearTimeout(dragEndTimerRef.current);
    }
    dragEndTimerRef.current = setTimeout(() => {
      if (!momentumActiveRef.current) {
        handleScrollEnd(event);
      }
    }, 80);
  }, [handleScrollEnd]);

  const handleMomentumBegin = useCallback(() => {
    momentumActiveRef.current = true;
    if (dragEndTimerRef.current) {
      clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
    }
  }, []);

  const handleMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    momentumActiveRef.current = false;
    handleScrollEnd(event);
  }, [handleScrollEnd]);

  const renderItem = useCallback(({ item, index }: { item: WheelOption; index: number }) => {
    const active = index === selectedIndex;
    return (
      <View style={styles.wheelItem}>
        <Text
          numberOfLines={1}
          style={[
            styles.wheelText,
            active && styles.wheelTextActive,
            item.disabled && styles.wheelTextDisabled,
          ]}
        >
          {item.label}
        </Text>
      </View>
    );
  }, [selectedIndex]);

  return (
    <View style={[styles.wheelColumn, { flex }]}>
      <FlatList
        ref={listRef}
        data={options}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={styles.wheelPadding}
        onMomentumScrollBegin={handleMomentumBegin}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleDragEnd}
        initialNumToRender={VISIBLE_ITEMS + 4}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
      />
    </View>
  );
}

export function roundUpToMinuteInterval(date: Date, interval: number) {
  const next = new Date(date);
  const remainder = next.getMinutes() % interval;
  if (remainder !== 0 || next.getSeconds() !== 0 || next.getMilliseconds() !== 0) {
    next.setMinutes(next.getMinutes() + (interval - remainder), 0, 0);
  }
  return next;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function normalisePickerValue(value: Date, minimumDate: Date | undefined, interval: number) {
  return clampToMinimum(roundUpToMinuteInterval(value, interval), minimumDate);
}

function clampToMinimum(value: Date, minimumDate?: Date) {
  if (!minimumDate || value >= minimumDate) return value;
  return new Date(minimumDate);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function wouldBeBeforeMinimum(base: Date, minimumDate: Date | undefined, hour: number, minute: number) {
  if (!minimumDate) return false;
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next < minimumDate;
}

function sameMinute(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) < 60_000;
}

function nearestEnabledIndex(options: WheelOption[], index: number) {
  if (!options[index]?.disabled) return index;

  for (let distance = 1; distance < options.length; distance += 1) {
    const after = index + distance;
    if (after < options.length && !options[after]?.disabled) return after;

    const before = index - distance;
    if (before >= 0 && !options[before]?.disabled) return before;
  }

  return index;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatWheelDay(date: Date) {
  if (isSameDay(date, new Date())) return "Today";
  const tomorrow = addDays(startOfDay(new Date()), 1);
  if (isSameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatSummary(date: Date) {
  return `${formatWheelDay(date)} at ${date.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#F8FAF9",
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D7DED9",
    marginBottom: 14,
  },
  header: {
    alignItems: "center",
    marginBottom: 14,
  },
  kicker: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 1.35,
    textTransform: "uppercase",
    color: "#0a8050",
    marginBottom: 4,
  },
  title: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.7,
    color: "#101414",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 2,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#63706c",
    textAlign: "center",
  },
  summary: {
    marginTop: 9,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#101414",
    paddingHorizontal: 14,
    paddingVertical: 7,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  quickPill: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE4DF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  quickPillActive: {
    borderColor: "#0a8050",
    backgroundColor: "#E8F7EF",
  },
  quickText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    color: "#31413B",
  },
  quickTextActive: {
    color: "#0a8050",
  },
  wheelCard: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E0E8E3",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  selectionBand: {
    position: "absolute",
    top: WHEEL_PADDING,
    left: 8,
    right: 8,
    height: ITEM_HEIGHT,
    borderRadius: 15,
    backgroundColor: "rgba(10, 128, 80, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(10, 128, 80, 0.18)",
  },
  wheelColumn: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
  },
  wheelPadding: {
    paddingVertical: WHEEL_PADDING,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  wheelText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: "#75827D",
    textAlign: "center",
    includeFontPadding: false,
  },
  wheelTextActive: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 18,
    color: "#101414",
  },
  wheelTextDisabled: {
    opacity: 0.24,
  },
  columnDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#E3EAE5",
  },
  timeSeparator: {
    alignSelf: "center",
    marginHorizontal: -3,
    marginTop: -1,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 18,
    color: "#101414",
    zIndex: 2,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
  },
  cancelButton: {
    minHeight: 52,
    flex: 0.85,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE4DF",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    color: "#46534E",
  },
  confirmButton: {
    minHeight: 52,
    flex: 1.45,
    borderRadius: 16,
    backgroundColor: "#0a8050",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});
