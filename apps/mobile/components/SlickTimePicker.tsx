import { type ComponentType, type Ref, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  type FlatList,
  type FlatListProps,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as Haptics from "expo-haptics";
import { radius } from "../styles/theme";

// The frosted backdrop needs expo-blur's native view. On a dev client that
// hasn't been rebuilt with the module yet, mounting it renders a broken native
// view and spams warnings — so we only reach for it when the native side is
// actually registered, and fall back to the plain scrim otherwise.
const BLUR_AVAILABLE = requireOptionalNativeModule("ExpoBlurView") != null;

type SlickTimePickerProps = {
  visible: boolean;
  title?: string;
  value: Date;
  minimumDate?: Date;
  minuteInterval?: number;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: Date) => void;
};

type WheelItem = {
  key: string;
  label: string;
};

const ITEM_HEIGHT = 46;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const WHEEL_PADDING = ITEM_HEIGHT * ((VISIBLE_ITEMS - 1) / 2);
const DAY_OPTION_COUNT = 60;
// Target size of a looping wheel's repeated buffer. Big enough that a normal
// fling won't reach an edge before we recenter, small enough to stay smooth in
// a non-virtualized ScrollView.
const LOOP_TARGET_ITEMS = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const GREEN = "#0a8050";
const INK = "#101414";

export function SlickTimePicker({
  visible,
  title = "When will you arrive?",
  value,
  minimumDate,
  minuteInterval = 5,
  confirmLabel = "Done",
  onCancel,
  onConfirm,
}: SlickTimePickerProps) {
  const insets = useSafeAreaInsets();

  const dayOptions = useMemo(() => {
    const minStart = startOfDay(minimumDate ?? new Date());
    return Array.from({ length: DAY_OPTION_COUNT }, (_, i) => addDays(minStart, i));
  }, [minimumDate]);

  const minuteValues = useMemo(
    () => Array.from({ length: Math.floor(60 / minuteInterval) }, (_, i) => i * minuteInterval),
    [minuteInterval]
  );

  // The wheels are uncontrolled: they own their scroll position and report the
  // landed index into this ref. We never set state while spinning, so nothing
  // re-renders mid-interaction — the Date is assembled only when Done is tapped.
  const selection = useRef({ day: 0, hour: 0, minute: 0 });

  // Bumped on each open so the wheels remount fresh at the incoming value.
  const [session, setSession] = useState(0);
  const initialRef = useRef(normalise(value, minimumDate, minuteInterval));

  // Mount/unmount the modal around the slide so the exit animation can play.
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown

  useEffect(() => {
    if (visible) {
      const init = normalise(value, minimumDate, minuteInterval);
      initialRef.current = init;
      selection.current = {
        day: Math.max(0, dayOptions.findIndex((d) => isSameDay(d, init))),
        hour: init.getHours(),
        minute: Math.max(0, minuteValues.findIndex((m) => m === init.getMinutes())),
      };
      setSession((s) => s + 1);
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Android hardware back closes the sheet (this replaced the Modal's
  // onRequestClose when we moved to an in-tree overlay).
  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [mounted, onCancel]);

  const dayItems = useMemo<WheelItem[]>(
    () => dayOptions.map((day) => ({ key: day.toISOString(), label: formatDay(day) })),
    [dayOptions]
  );

  const hourItems = useMemo<WheelItem[]>(
    () => HOURS.map((hour) => ({ key: String(hour), label: String(hour).padStart(2, "0") })),
    []
  );

  const minuteItems = useMemo<WheelItem[]>(
    () =>
      minuteValues.map((minute) => ({ key: String(minute), label: String(minute).padStart(2, "0") })),
    [minuteValues]
  );

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const day = dayOptions[selection.current.day] ?? dayOptions[0];
    const next = new Date(day);
    next.setHours(
      HOURS[selection.current.hour] ?? 0,
      minuteValues[selection.current.minute] ?? 0,
      0,
      0
    );
    const picked = clampToMinimum(next, minimumDate);
    // If the value is identical to what we opened with, don't ask the caller to
    // update anything (it would needlessly re-fetch) — just close.
    if (picked.getTime() === initialRef.current.getTime()) {
      onCancel();
      return;
    }
    onConfirm(picked);
  }, [dayOptions, minuteValues, minimumDate, onConfirm, onCancel]);

  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const sheetTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [WHEEL_HEIGHT + 320, 0] });
  // Wheels "settle" in slightly after the sheet — a small extra drop that eases out.
  const wheelSettle = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [26, 10, 0] });

  const init = initialRef.current;
  const initDayIndex = Math.max(0, dayOptions.findIndex((d) => isSameDay(d, init)));
  const initHourIndex = init.getHours();
  const initMinuteIndex = Math.max(0, minuteValues.findIndex((m) => m === init.getMinutes()));

  if (!mounted) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <AnimatedPressable
        style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]}
        onPress={onCancel}
      >
        <BlurBackdrop />
        <View style={styles.scrim} />
      </AnimatedPressable>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(24, insets.bottom + 18),
              transform: [{ translateY: sheetTranslate }],
            },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>

          <Animated.View style={[styles.wheelCard, { transform: [{ translateY: wheelSettle }] }]}>
            {/* A whisper-soft seat for the selection — no border, barely tinted,
                so the value emerges rather than sitting in a box. */}
            <View style={styles.selectionBand} pointerEvents="none" />

            <View style={styles.wheelRow}>
              <Wheel
                key={`day-${session}`}
                items={dayItems}
                initialIndex={initDayIndex}
                onChange={(i) => {
                  selection.current.day = i;
                }}
                align="right"
                width={132}
                fontSize={16}
              />
              <View style={styles.wheelGap} />
              <Wheel
                key={`hour-${session}`}
                items={hourItems}
                initialIndex={initHourIndex}
                onChange={(i) => {
                  selection.current.hour = i;
                }}
                align="center"
                width={46}
                fontSize={21}
                loop
              />
              <Text style={styles.colon}>:</Text>
              <Wheel
                key={`min-${session}`}
                items={minuteItems}
                initialIndex={initMinuteIndex}
                onChange={(i) => {
                  selection.current.minute = i;
                }}
                align="center"
                width={46}
                fontSize={21}
                loop
              />
            </View>

            {/* Depth: fade the top and bottom into the glass so the wheel reads
                as a curved surface receding into the sheet. */}
            <LinearGradient
              colors={["#FFFFFF", "rgba(255,255,255,0.86)", "rgba(255,255,255,0)"]}
              locations={[0, 0.55, 1]}
              style={[styles.fade, styles.fadeTop]}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.86)", "#FFFFFF"]}
              locations={[0, 0.45, 1]}
              style={[styles.fade, styles.fadeBottom]}
              pointerEvents="none"
            />
          </Animated.View>

          <Pressable
            style={({ pressed }) => [styles.confirmButton, pressed && styles.confirmButtonPressed]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </Pressable>
        </Animated.View>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function BlurBackdrop() {
  if (!BLUR_AVAILABLE) return null;
  return <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFillObject} />;
}

function Wheel({
  items,
  initialIndex,
  onChange,
  align,
  width,
  fontSize = 21,
  loop = false,
}: {
  items: WheelItem[];
  initialIndex: number;
  onChange: (index: number) => void;
  align: "left" | "center" | "right";
  width: number;
  fontSize?: number;
  loop?: boolean;
}) {
  const scrollRef = useRef<FlatList<WheelItem>>(null);
  const baseLength = items.length;

  // For looping wheels we repeat the values a handful of times and start on the
  // middle copy, recentering after each rest (identical copies make the jump
  // invisible). We keep the buffer small — a plain ScrollView renders every row,
  // so hundreds of copies would make the wheel heavy and janky.
  const copies = loop ? oddCeil(LOOP_TARGET_ITEMS / Math.max(1, baseLength)) : 1;
  const middleStart = loop ? Math.floor(copies / 2) * baseLength : 0;
  const data = useMemo(() => {
    if (!loop) return items;
    return Array.from({ length: copies * baseLength }, (_, i) => items[i % baseLength]);
  }, [items, loop, copies, baseLength]);

  const virtualFor = useCallback((baseIndex: number) => middleStart + baseIndex, [middleStart]);

  const scrollY = useRef(new Animated.Value(virtualFor(initialIndex) * ITEM_HEIGHT)).current;
  const indexRef = useRef(initialIndex);
  const hapticRef = useRef(virtualFor(initialIndex));
  const lastHapticAt = useRef(0);
  const momentumRef = useRef(false);
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialOffset = virtualFor(initialIndex) * ITEM_HEIGHT;

  // Land on the initial value after mount (the wheel remounts on each open).
  // initialScrollIndex handles the common case; this is a belt-and-braces nudge.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      scrollRef.current?.scrollToOffset({ offset: initialOffset, animated: false })
    );
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (dragTimer.current) clearTimeout(dragTimer.current);
    },
    []
  );

  // A light "tick" as each item crosses the centre. We read it from the
  // throttled scroll event (not a per-frame Animated listener, which would
  // bridge every frame and stutter) and rate-limit it so a fast fling doesn't
  // machine-gun the haptic engine.
  const onScrollTick = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (i === hapticRef.current) return;
    hapticRef.current = i;
    const now = Date.now();
    if (now - lastHapticAt.current < 40) return;
    lastHapticAt.current = now;
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const settle = useCallback(
    (rawY: number) => {
      const rawVirtual = clamp(Math.round(rawY / ITEM_HEIGHT), 0, data.length - 1);
      const baseIndex = loop ? ((rawVirtual % baseLength) + baseLength) % baseLength : rawVirtual;

      // Land (and, for loops, recenter to the middle copy) without a visible
      // jump — identical copies mean the numbers under the band don't change.
      const targetVirtual = virtualFor(baseIndex);
      scrollRef.current?.scrollToOffset({
        offset: targetVirtual * ITEM_HEIGHT,
        animated: !loop && targetVirtual * ITEM_HEIGHT !== rawY,
      });
      hapticRef.current = targetVirtual;

      if (baseIndex !== indexRef.current) {
        indexRef.current = baseIndex;
        onChange(baseIndex);
      }
    },
    [data.length, loop, baseLength, virtualFor, onChange]
  );

  const onMomentumBegin = useCallback(() => {
    momentumRef.current = true;
    if (dragTimer.current) {
      clearTimeout(dragTimer.current);
      dragTimer.current = null;
    }
  }, []);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      momentumRef.current = false;
      settle(e.nativeEvent.contentOffset.y);
    },
    [settle]
  );

  const onDragEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (dragTimer.current) clearTimeout(dragTimer.current);
      // Only settle from the drag if momentum never kicks in (a slow release).
      dragTimer.current = setTimeout(() => {
        if (!momentumRef.current) settle(y);
      }, 90);
    },
    [settle]
  );

  // If the initial index is outside the first render window, FlatList asks us to
  // resolve it — we know every row is ITEM_HEIGHT, so jump straight to it.
  const onScrollToIndexFailed = useCallback((info: { index: number }) => {
    scrollRef.current?.scrollToOffset({ offset: info.index * ITEM_HEIGHT, animated: false });
  }, []);

  const textStyle = [
    styles.itemText,
    { fontSize },
    align === "left" && styles.itemTextLeft,
    align === "right" && styles.itemTextRight,
    align === "center" && styles.itemTextCenter,
  ];

  const renderItem = useCallback(
    ({ index }: ListRenderItemInfo<WheelItem>) => {
      const pos = index * ITEM_HEIGHT;
      const inputRange = [
        pos - 2 * ITEM_HEIGHT,
        pos - ITEM_HEIGHT,
        pos,
        pos + ITEM_HEIGHT,
        pos + 2 * ITEM_HEIGHT,
      ];
      // A gentle cylinder: rows rotate away as they leave the centre for depth,
      // but the scale barely changes — the selected value only *emerges* (via
      // ink) rather than ballooning. Neighbours recede fast.
      const rotateX = scrollY.interpolate({
        inputRange,
        outputRange: ["42deg", "22deg", "0deg", "-22deg", "-42deg"],
        extrapolate: "clamp",
      });
      const scale = scrollY.interpolate({
        inputRange,
        outputRange: [0.9, 0.96, 1.06, 0.96, 0.9],
        extrapolate: "clamp",
      });
      const opacity = scrollY.interpolate({
        inputRange,
        outputRange: [0.12, 0.32, 1, 0.32, 0.12],
        extrapolate: "clamp",
      });
      return (
        <Animated.View
          style={[styles.item, { transform: [{ perspective: 700 }, { rotateX }, { scale }], opacity }]}
        >
          <Text numberOfLines={1} style={textStyle}>
            {data[index]?.label}
          </Text>
        </Animated.View>
      );
    },
    // textStyle is derived from stable props; scrollY/data are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrollY, data]
  );

  return (
    <View style={[styles.wheel, { width }]}>
      <AnimatedFlatList
        ref={scrollRef}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={virtualFor(initialIndex)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        initialNumToRender={VISIBLE_ITEMS + 2}
        maxToRenderPerBatch={VISIBLE_ITEMS + 4}
        windowSize={5}
        removeClippedSubviews
        onScrollToIndexFailed={onScrollToIndexFailed}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: onScrollTick,
        })}
        onMomentumScrollBegin={onMomentumBegin}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollEndDrag={onDragEnd}
        contentContainerStyle={styles.wheelContent}
      />
    </View>
  );
}

const AnimatedFlatList = Animated.FlatList as unknown as ComponentType<
  FlatListProps<WheelItem> & { ref?: Ref<FlatList<WheelItem>> }
>;

function keyExtractor(_: WheelItem, index: number) {
  return String(index);
}

function getItemLayout(_: ArrayLike<WheelItem> | null | undefined, index: number) {
  return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index };
}

/* ─── date helpers ─────────────────────────────────────────── */

function normalise(value: Date, minimumDate: Date | undefined, interval: number) {
  return clampToMinimum(roundUp(value, interval), minimumDate);
}

function roundUp(date: Date, interval: number) {
  const next = new Date(date);
  const remainder = next.getMinutes() % interval;
  if (remainder !== 0 || next.getSeconds() !== 0 || next.getMilliseconds() !== 0) {
    next.setMinutes(next.getMinutes() + (interval - remainder), 0, 0);
  }
  return next;
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

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function oddCeil(x: number) {
  const n = Math.max(3, Math.ceil(x));
  return n % 2 === 0 ? n + 1 : n;
}

function formatDay(date: Date) {
  if (isSameDay(date, new Date())) return "Today";
  if (isSameDay(date, addDays(startOfDay(new Date()), 1))) return "Tomorrow";
  return date.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
}

/* ─── styles ───────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 100,
    elevation: 100,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9, 15, 12, 0.55)",
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 12,
    shadowColor: "#0B1F17",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 24,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E1E6E2",
    marginBottom: 20,
  },
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.4,
    color: INK,
    textAlign: "center",
    marginBottom: 12,
  },
  wheelCard: {
    height: WHEEL_HEIGHT,
    justifyContent: "center",
    marginTop: 4,
  },
  selectionBand: {
    position: "absolute",
    top: WHEEL_PADDING,
    left: 20,
    right: 20,
    height: ITEM_HEIGHT,
    borderRadius: 16,
    backgroundColor: "rgba(17, 20, 19, 0.035)",
  },
  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  wheelGap: {
    width: 14,
  },
  colon: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 20,
    color: INK,
    opacity: 0.85,
    marginHorizontal: 1,
    marginTop: -2,
    fontVariant: ["tabular-nums"],
  },
  wheel: {
    height: WHEEL_HEIGHT,
  },
  wheelContent: {
    paddingVertical: WHEEL_PADDING,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
  },
  itemText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 21,
    letterSpacing: 0.1,
    color: INK,
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
  itemTextLeft: {
    textAlign: "left",
    paddingLeft: 4,
  },
  itemTextRight: {
    textAlign: "right",
    paddingRight: 10,
  },
  itemTextCenter: {
    textAlign: "center",
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    height: WHEEL_PADDING,
  },
  fadeTop: {
    top: 0,
  },
  fadeBottom: {
    bottom: 0,
  },
  confirmButton: {
    height: 56,
    marginTop: 22,
    marginHorizontal: 2,
    borderRadius: radius.pill,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  confirmButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: Platform.OS === "ios" ? 0.92 : 1,
  },
  confirmText: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 17,
    letterSpacing: 0.2,
    color: "#FFFFFF",
  },
});
