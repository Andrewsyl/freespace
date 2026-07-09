import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
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

// Enough repeated rows to make hour/minute wheels feel continuous without
// creating thousands of animated interpolation nodes every time the picker opens.
const LOOP_REPEAT = 30;

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
// DrumColumn — single scrollable wheel

export interface DrumColumnHandle {
  adjustBy: (delta: number) => void;
  scrollToRealIndex: (realIdx: number) => void;
}

interface ColumnProps {
  items: readonly string[];
  initialIndex: number;
  onIndexChange: (realIdx: number) => void;
  flex?: number;
  loop?: boolean;
}

const DrumColumn = forwardRef<DrumColumnHandle, ColumnProps>(
  function DrumColumn({ items, initialIndex, onIndexChange, flex = 1, loop = false }, ref) {
    const listRef = useRef<FlatList<string>>(null);

    const loopOffset = loop ? Math.floor(LOOP_REPEAT / 2) * items.length : 0;

    const displayItems = useMemo<string[]>(
      () =>
        loop
          ? Array.from(
              { length: items.length * LOOP_REPEAT },
              (_, i) => items[i % items.length] as string
            )
          : (items as string[]),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    const mountIndex = useRef(initialIndex + loopOffset);

    const scrollY = useRef(new Animated.Value(mountIndex.current * ITEM_HEIGHT)).current;

    // Track current tiled index for imperative adjustBy
    const tiledIdxRef = useRef(mountIndex.current);

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

    useEffect(() => {
      const offset = mountIndex.current * ITEM_HEIGHT;
      const t = setTimeout(() => {
        listRef.current?.scrollToOffset({ offset, animated: false });
      }, 60);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const scrollHandler = useMemo(
      () =>
        Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        ) as unknown as (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
      [scrollY]
    );

    const lastEmitted = useRef(initialIndex);

    const handleScrollEnd = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const raw = e.nativeEvent.contentOffset.y / ITEM_HEIGHT;
        const tiledIdx = Math.max(0, Math.min(displayItems.length - 1, Math.round(raw)));
        tiledIdxRef.current = tiledIdx;
        const realIdx = loop ? tiledIdx % items.length : tiledIdx;
        if (realIdx === lastEmitted.current) return;
        lastEmitted.current = realIdx;
        onIndexChange(realIdx);
      },
      [displayItems.length, items.length, loop, onIndexChange]
    );

    useImperativeHandle(ref, () => ({
      adjustBy: (delta: number) => {
        const newTiledIdx = Math.max(
          0,
          Math.min(displayItems.length - 1, tiledIdxRef.current + delta)
        );
        tiledIdxRef.current = newTiledIdx;
        const newRealIdx = loop ? newTiledIdx % items.length : newTiledIdx;
        lastEmitted.current = newRealIdx;
        listRef.current?.scrollToOffset({ offset: newTiledIdx * ITEM_HEIGHT, animated: true });
      },
      scrollToRealIndex: (realIdx: number) => {
        // Find the tiled position nearest to where the wheel currently sits
        const cur = tiledIdxRef.current;
        const cycle = Math.floor(cur / items.length);
        const candidates = [
          (cycle - 1) * items.length + realIdx,
          cycle * items.length + realIdx,
          (cycle + 1) * items.length + realIdx,
        ];
        const nearest = candidates.reduce((best, c) =>
          Math.abs(c - cur) < Math.abs(best - cur) ? c : best
        );
        const clamped = Math.max(0, Math.min(displayItems.length - 1, nearest));
        tiledIdxRef.current = clamped;
        lastEmitted.current = realIdx;
        listRef.current?.scrollToOffset({ offset: clamped * ITEM_HEIGHT, animated: true });
      },
    }));

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
          initialNumToRender={VISIBLE + 4}
          windowSize={5}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={16}
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
);

// ─────────────────────────────────────────────────────────────────────────────
// Public API

export interface DrumRollPickerHandle {
  /** Instantly scroll all wheels to reflect a new date (no remount needed). */
  setTime: (date: Date) => void;
}

export interface DrumRollPickerProps {
  date: Date;
  onChange: (date: Date) => void;
  minuteInterval?: number;
  drumRef?: Ref<DrumRollPickerHandle>;
  /** Show only the date wheel (no hour/minute) — e.g. monthly "arrive from". */
  dateOnly?: boolean;
}

export function DrumRollPicker({ date, onChange, minuteInterval = 5, drumRef, dateOnly = false }: DrumRollPickerProps) {
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

  const hourLabels = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), []);
  const initialHourIndex = date.getHours();

  const minuteSteps = Math.floor(60 / minuteInterval);
  const minuteLabels = useMemo(
    () => Array.from({ length: minuteSteps }, (_, i) => pad2(i * minuteInterval)),
    [minuteSteps, minuteInterval]
  );
  const initialMinuteIndex = useMemo(
    () => Math.max(0, Math.min(minuteSteps - 1, Math.round(date.getMinutes() / minuteInterval))),
    [date, minuteInterval, minuteSteps]
  );

  const state = useRef({
    dateIndex: initialDateIndex,
    hour: initialHourIndex,
    minuteIndex: initialMinuteIndex,
  });

  const dateColRef = useRef<DrumColumnHandle>(null);
  const hourColRef = useRef<DrumColumnHandle>(null);
  const minColRef  = useRef<DrumColumnHandle>(null);

  useImperativeHandle(drumRef, () => ({
    setTime: (d: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayDiff = Math.round(
        (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86_400_000
      );
      const newDateIdx = Math.max(0, Math.min(dates.length - 1, dayDiff));
      const newHour = d.getHours();
      const newMinIdx = Math.max(0, Math.min(minuteSteps - 1, Math.round(d.getMinutes() / minuteInterval)));

      state.current.dateIndex = newDateIdx;
      state.current.hour = newHour;
      state.current.minuteIndex = newMinIdx;

      dateColRef.current?.scrollToRealIndex(newDateIdx);
      hourColRef.current?.scrollToRealIndex(newHour);
      minColRef.current?.scrollToRealIndex(newMinIdx);
    },
  }));

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
      <DrumColumn ref={dateColRef} items={dateLabels} initialIndex={initialDateIndex} onIndexChange={handleDate} flex={2} />
      {dateOnly ? null : (
        <>
          <View style={drum.divider} />
          <DrumColumn ref={hourColRef} items={hourLabels} initialIndex={initialHourIndex} onIndexChange={handleHour} flex={1} loop />
          <View style={drum.divider} />
          <DrumColumn ref={minColRef}  items={minuteLabels} initialIndex={initialMinuteIndex} onIndexChange={handleMinute} flex={1} loop />
        </>
      )}
      <View style={drum.band} pointerEvents="none" />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles

const col = StyleSheet.create({
  wrap: { height: PICKER_HEIGHT, overflow: "hidden" },
  listPad: { paddingVertical: ITEM_HEIGHT * PAD },
  item: { height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
  text: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: "#111827",
    textAlign: "center",
    includeFontPadding: false,
    letterSpacing: -0.1,
  },
});

const drum = StyleSheet.create({
  container: {
    height: PICKER_HEIGHT,
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    alignSelf: "stretch",
  },
  band: {
    position: "absolute",
    top: ITEM_HEIGHT * PAD,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: "rgba(10, 128, 80, 0.10)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(10, 128, 80, 0.22)",
  },
});
