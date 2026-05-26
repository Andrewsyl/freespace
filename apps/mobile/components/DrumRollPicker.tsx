import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Constants

const ITEM_HEIGHT = 46;
const VISIBLE = 7; // rows visible (3 above centre + selected + 3 below)
const PAD = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE;

// How many times to tile a looping column's data.
// 100× means the user can spin ~50 full cycles before hitting an edge.
const LOOP_REPEAT = 100;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function dayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single scrollable column
// Opacity is driven by an Animated.Value (native driver) so it updates
// in real-time during scroll — no React state updates, no flicker.

interface ColumnProps {
  items: readonly string[];
  initialIndex: number;
  onIndexChange: (i: number) => void;
  flex?: number;
  /** If true, tiles the item list so the wheel appears to scroll infinitely. */
  loop?: boolean;
}

function DrumColumn({ items, initialIndex, onIndexChange, flex = 1, loop = false }: ColumnProps) {
  const listRef = useRef<FlatList<string>>(null);

  // For looping columns we tile the data LOOP_REPEAT times and start in the
  // centre so there's equal travel in both directions before hitting an edge.
  const loopOffset = loop ? Math.floor(LOOP_REPEAT / 2) * items.length : 0;

  // Build the display list once at mount. For loop columns this is e.g.
  // 12 minutes × 100 = 1 200 rows; for the date column it's just 91 rows.
  const displayItems = useMemo<string[]>(
    () =>
      loop
        ? Array.from(
            { length: items.length * LOOP_REPEAT },
            (_, i) => items[i % items.length] as string
          )
        : (items as string[]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // stable after mount — items and loop don't change
  );

  // Capture the effective scroll index at mount and never re-read the prop.
  // This prevents parent re-renders (triggered by our own onChange callbacks)
  // from resetting scrollY mid-scroll and causing the selected-item flicker.
  const mountIndex = useRef(initialIndex + loopOffset);

  // Animated scroll offset — seeded from the mount-time index
  const scrollY = useRef(new Animated.Value(mountIndex.current * ITEM_HEIGHT)).current;

  // Pre-compute one interpolation per display row; stable after mount.
  // Each interpolation is tiny (5 input/output pairs) so even 1 200 of them
  // is negligible — and FlatList's virtualisation means only ~10 are ever
  // connected to native views at once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const opacities = useMemo(
    () =>
      displayItems.map((_, index) => {
        const centre = index * ITEM_HEIGHT;
        return scrollY.interpolate({
          inputRange: [
            centre - ITEM_HEIGHT * 3,
            centre - ITEM_HEIGHT * 1.5,
            centre,
            centre + ITEM_HEIGHT * 1.5,
            centre + ITEM_HEIGHT * 3,
          ],
          outputRange: [0.07, 0.26, 1.0, 0.26, 0.07],
          extrapolate: "clamp",
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Scroll to the initial position on mount only.
  // Empty deps is intentional — see mountIndex comment above.
  useEffect(() => {
    const offset = mountIndex.current * ITEM_HEIGHT;
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset, animated: false });
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animated.event keeps scrollY in sync with the native scroll position
  const scrollHandler = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true }
      ) as unknown as (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
    [scrollY]
  );

  // lastEmitted stores the *real* index (0..items.length-1), not the tiled one
  const lastEmitted = useRef(initialIndex);
  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = e.nativeEvent.contentOffset.y / ITEM_HEIGHT;
      const tiledIdx = Math.max(0, Math.min(displayItems.length - 1, Math.round(raw)));
      const realIdx = loop ? tiledIdx % items.length : tiledIdx;
      if (realIdx === lastEmitted.current) return;
      lastEmitted.current = realIdx;
      onIndexChange(realIdx);
    },
    [displayItems.length, items.length, loop, onIndexChange]
  );

  // renderItem is stable — opacities array doesn't change
  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <View style={col.item}>
        <Animated.Text style={[col.text, { opacity: opacities[index] }]}>
          {item}
        </Animated.Text>
      </View>
    ),
    [opacities]
  );

  return (
    <View style={[col.wrap, { flex }]}>
      <Animated.FlatList
        ref={listRef}
        data={displayItems}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={col.listPad}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API

export interface DrumRollPickerProps {
  date: Date;
  onChange: (date: Date) => void;
  minuteInterval?: number;
}

export function DrumRollPicker({ date, onChange, minuteInterval = 5 }: DrumRollPickerProps) {
  // Date column — today + 90 days (linear, no looping)
  const dates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: Date[] = [];
    for (let i = 0; i < 91; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      result.push(d);
    }
    return result;
  }, []);

  const dateLabels = useMemo(() => dates.map((d) => dayLabel(d)), [dates]);

  const initialDateIndex = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    return Math.max(0, Math.min(dates.length - 1, diff));
  }, [date, dates.length]);

  // Hour column — 00–23 (looping)
  const hourLabels = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), []);
  const initialHourIndex = date.getHours();

  // Minute column (looping)
  const minuteSteps = Math.floor(60 / minuteInterval);
  const minuteLabels = useMemo(
    () => Array.from({ length: minuteSteps }, (_, i) => pad2(i * minuteInterval)),
    [minuteSteps, minuteInterval]
  );
  const initialMinuteIndex = useMemo(
    () => Math.max(0, Math.min(minuteSteps - 1, Math.round(date.getMinutes() / minuteInterval))),
    [date, minuteInterval, minuteSteps]
  );

  // Stable ref for current column selections (real indices, 0-based)
  const state = useRef({
    dateIndex: initialDateIndex,
    hour: initialHourIndex,
    minuteIndex: initialMinuteIndex,
  });

  const emit = useCallback(
    (dateIdx: number, hour: number, minIdx: number) => {
      const base = dates[dateIdx] ?? dates[0];
      const next = new Date(base as Date);
      next.setHours(hour, minIdx * minuteInterval, 0, 0);
      onChange(next);
    },
    [dates, minuteInterval, onChange]
  );

  const handleDate = useCallback(
    (i: number) => { state.current.dateIndex = i; emit(i, state.current.hour, state.current.minuteIndex); },
    [emit]
  );
  const handleHour = useCallback(
    (i: number) => { state.current.hour = i; emit(state.current.dateIndex, i, state.current.minuteIndex); },
    [emit]
  );
  const handleMinute = useCallback(
    (i: number) => { state.current.minuteIndex = i; emit(state.current.dateIndex, state.current.hour, i); },
    [emit]
  );

  return (
    <View style={drum.container}>
      <DrumColumn items={dateLabels} initialIndex={initialDateIndex} onIndexChange={handleDate} flex={2} />
      <View style={drum.divider} />
      <DrumColumn items={hourLabels} initialIndex={initialHourIndex} onIndexChange={handleHour} flex={1} loop />
      <View style={drum.divider} />
      <DrumColumn items={minuteLabels} initialIndex={initialMinuteIndex} onIndexChange={handleMinute} flex={1} loop />
      <View style={drum.band} pointerEvents="none" />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles

const col = StyleSheet.create({
  wrap: { height: PICKER_HEIGHT, overflow: "hidden" },
  listPad: { paddingVertical: ITEM_HEIGHT * PAD },
  item: { height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  text: {
    fontFamily: "Inter-SemiBold",
    fontSize: 17,
    color: "#111111",
    textAlign: "center",
    includeFontPadding: false,
  },
});

const drum = StyleSheet.create({
  container: {
    height: PICKER_HEIGHT,
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    overflow: "hidden",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#D0D0D0",
    marginVertical: 8,
    alignSelf: "stretch",
  },
  band: {
    position: "absolute",
    top: ITEM_HEIGHT * PAD,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: "rgba(46, 204, 143, 0.12)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(46, 204, 143, 0.38)",
  },
});
