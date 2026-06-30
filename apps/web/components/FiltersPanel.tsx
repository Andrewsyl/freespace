"use client";
import * as Slider from "@radix-ui/react-slider";
import { BatteryCharging, Cctv, House, Lock, Route, SquareParking, Warehouse, Zap } from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ComponentType,
  ReactNode,
} from "react";
import type { SearchFilters } from "./SearchForm";

const SPACE_TYPE_OPTIONS = [
  { label: "Driveway", value: "Private Driveway", icon: House },
  { label: "Garage", value: "Garage", icon: Warehouse },
  { label: "Car park", value: "Car park", icon: SquareParking },
  { label: "Private road", value: "Private road", icon: Route },
] as const;

const VEHICLE_SIZE_OPTIONS = [
  { label: "Any", value: undefined },
  { label: "Motorcycle", value: "motorcycle" },
  { label: "Car", value: "car" },
  { label: "Van", value: "van" },
] as const;

const DEFAULT_PRICE_MIN = 0;
const DEFAULT_PRICE_MAX = 60;
const DEFAULT_PRICE_STEP = 5;
const PRICE_BUCKET_COUNT = 18;
const EMPTY_PRICE_HISTOGRAM = [4, 6, 8, 12, 18, 26, 34, 42, 48, 44, 38, 31, 28, 24, 20, 16, 13, 10];

export function FiltersPanel({
  initialFilters,
  onApply,
  onCancel: _onCancel,
  onLiveChange,
  searchAsMove,
  onSearchAsMove,
  priceValues = [],
}: {
  initialFilters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onCancel?: () => void;
  onLiveChange?: (filters: SearchFilters) => void;
  searchAsMove?: boolean;
  onSearchAsMove?: (v: boolean) => void;
  priceValues?: number[];
}) {
  const [pending, setPending] = useState<SearchFilters>(initialFilters);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => { setPending(initialFilters); }, [initialFilters]);

  const update = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) =>
    setPending((prev) => ({ ...prev, [key]: value }));

  // Debounced live-change for desktop
  useEffect(() => {
    if (!onLiveChange) return;
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onLiveChange(pending), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [pending, onLiveChange]);

  const activeFilterCount = [
    pending.priceMin, pending.priceMax, pending.securityLevel,
    pending.vehicleSize, pending.spaceType, pending.coveredParking, pending.evCharging, pending.instantBook,
  ].filter(Boolean).length;

  const clearFilters = () => {
    const cleared: SearchFilters = {
      ...pending,
      priceMin: undefined,
      priceMax: undefined,
      coveredParking: undefined,
      evCharging: undefined,
      securityLevel: undefined,
      vehicleSize: undefined,
      spaceType: undefined,
      instantBook: undefined,
    };
    setPending(cleared);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex min-h-[58px] items-center border-b border-[#eef2f6] bg-white px-4">
        <div className="w-[58px]" />
        <h2 className="flex-1 text-center text-base font-bold tracking-[-0.01em] text-[#111827]">
          Filters
        </h2>
        <button
          type="button"
          onClick={clearFilters}
          disabled={activeFilterCount === 0}
          className="flex min-h-11 w-[58px] items-center justify-center text-[13px] font-semibold text-[#0a8050] transition disabled:opacity-25"
        >
          Clear
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">

        {/* Search as I move */}
        {onSearchAsMove !== undefined && (
          <Section label="Map">
            <button
              type="button"
              onClick={() => onSearchAsMove(!searchAsMove)}
              className="flex w-full items-center justify-between rounded-2xl border border-[#e6ebf0] bg-[#f7f8fa] px-4 py-3.5 transition hover:bg-white"
            >
              <div className="text-left">
                <p className="text-[13px] font-semibold text-[#0f172a]">Search as I move</p>
                <p className="mt-0.5 text-[12px] text-slate-500">Re-search automatically when you pan the map</p>
              </div>
              <div className={`relative ml-4 h-7 w-[50px] shrink-0 rounded-full border-2 transition-colors duration-200 ${searchAsMove ? "border-transparent bg-[#0f172a]" : "border-slate-300 bg-slate-200"}`}>
                <span className={`absolute top-0 inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${searchAsMove ? "translate-x-[22px]" : "translate-x-0"}`} />
              </div>
            </button>
          </Section>
        )}

        {/* Mode */}
        <Section label="Mode">
          <div className="flex flex-wrap gap-2.5">
            {(["daily", "monthly"] as const).map((mode) => (
              <Chip
                key={mode}
                label={mode === "daily" ? "Daily" : "Monthly"}
                active={pending.mode === mode}
                onClick={() => update("mode", mode)}
              />
            ))}
          </div>
        </Section>

        {/* Price */}
        <Section label={pending.mode === "monthly" ? "Monthly price" : "Price shown"}>
          <PriceRangeSelector
            minValue={pending.priceMin}
            maxValue={pending.priceMax}
            priceValues={priceValues}
            onMinChange={(value) => update("priceMin", value)}
            onMaxChange={(value) => update("priceMax", value)}
          />
        </Section>

        {/* Popular */}
        <Section label="Popular">
          <div className="flex flex-wrap gap-2.5">
            <Chip
              label="Instant"
              icon={Zap}
              active={!!pending.instantBook}
              onClick={() => update("instantBook", !pending.instantBook)}
            />
            <Chip
              label="Covered"
              icon={House}
              active={!!pending.coveredParking}
              onClick={() => update("coveredParking", !pending.coveredParking)}
            />
            <Chip
              label="EV charging"
              icon={BatteryCharging}
              active={!!pending.evCharging}
              onClick={() => update("evCharging", !pending.evCharging)}
            />
            <Chip
              label="Gated"
              icon={Lock}
              active={pending.securityLevel === "gated"}
              onClick={() => update("securityLevel", pending.securityLevel === "gated" ? undefined : "gated")}
            />
            <Chip
              label="CCTV"
              icon={Cctv}
              active={pending.securityLevel === "cctv"}
              onClick={() => update("securityLevel", pending.securityLevel === "cctv" ? undefined : "cctv")}
            />
          </div>
        </Section>

        {/* Space type */}
        <Section label="Parking type">
          <div className="grid grid-cols-2 gap-2.5">
            {SPACE_TYPE_OPTIONS.map((type) => (
              <Tile
                key={type.value}
                label={type.label}
                icon={type.icon}
                active={pending.spaceType === type.value}
                onClick={() => update("spaceType", pending.spaceType === type.value ? undefined : type.value)}
              />
            ))}
          </div>
        </Section>

        {/* Vehicle size */}
        <Section label="Vehicle size">
          <div className="flex flex-wrap gap-2.5">
            {VEHICLE_SIZE_OPTIONS.map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                active={pending.vehicleSize === option.value || (!option.value && !pending.vehicleSize)}
                onClick={() => update("vehicleSize", option.value)}
              />
            ))}
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div
        className="border-t border-[#eef2f6] bg-white px-4 py-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <button
          type="button"
          onClick={() => onApply(pending)}
          className="min-h-[52px] w-full rounded-[14px] bg-[#0f172a] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#111827]"
        >
          Show spaces
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#eef2f6] py-5">
      <p className="mb-3 text-[17px] font-bold tracking-[-0.01em] text-[#111827]">
        {label}
      </p>
      {children}
    </section>
  );
}

function Chip({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center rounded-full border px-3.5 py-2.5 text-[13px] font-semibold tracking-[-0.01em] transition ${
        active
          ? "border-[#0f172a] bg-[#0f172a] text-white shadow-sm"
          : "border-[#e6ebf0] bg-[#f7f8fa] text-[#0f172a] hover:border-slate-300 hover:bg-white"
      }`}
    >
      {Icon ? <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.1} /> : null}
      {label}
    </button>
  );
}

function Tile({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] items-center gap-2.5 rounded-[14px] border px-3 py-3 text-left transition ${
        active
          ? "border-[#8fdcb3] bg-[#eefbf4] text-[#0a8050]"
          : "border-[#e6ebf0] bg-[#f7f8fa] text-[#0f172a] hover:border-slate-300 hover:bg-white"
      }`}
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#0a8050]" : "text-slate-500"}`} strokeWidth={2} />
      <span className="min-w-0 text-[13px] font-semibold tracking-[-0.01em]">{label}</span>
    </button>
  );
}

function PriceRangeSelector({
  minValue,
  maxValue,
  priceValues,
  onMinChange,
  onMaxChange,
}: {
  minValue?: number;
  maxValue?: number;
  priceValues: number[];
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
}) {
  const scale = useMemo(() => buildPriceScale(priceValues), [priceValues]);
  const selectedMin = clampPrice(minValue ?? scale.min, scale.min, scale.max - scale.step);
  const selectedMax = clampPrice(maxValue ?? scale.max, selectedMin + scale.step, scale.max);
  const selectedLeft = priceToPercent(selectedMin, scale);
  const selectedRight = 100 - priceToPercent(selectedMax, scale);

  const handleValueChange = ([nextMin = scale.min, nextMax = scale.max]: number[]) => {
    const safeMin = Math.min(nextMin, nextMax - scale.step);
    const safeMax = Math.max(nextMax, safeMin + scale.step);
    onMinChange(safeMin <= scale.min ? undefined : safeMin);
    onMaxChange(safeMax >= scale.max ? undefined : safeMax);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-slate-500">Minimum</p>
          <p className="mt-1 text-[20px] font-bold tracking-[-0.04em] text-[#111827]">
            €{formatPriceLabel(selectedMin)}
          </p>
        </div>
        <div className="h-px flex-1 bg-[#dfe3e8]" />
        <div className="text-right">
          <p className="text-[12px] font-semibold text-slate-500">Maximum</p>
          <p className="mt-1 text-[20px] font-bold tracking-[-0.04em] text-[#111827]">
            €{formatPriceLabel(selectedMax)}{selectedMax >= scale.max ? "+" : ""}
          </p>
        </div>
      </div>

      <p className="mb-3 text-[12px] font-semibold text-slate-500">
        {scale.count > 0
          ? `Current spaces range from €${formatPriceLabel(scale.observedMin)} to €${formatPriceLabel(scale.observedMax)}.`
          : "No current price data yet."}
      </p>

      <div className="relative h-[164px] select-none rounded-[24px] border border-[#e6ebf0] bg-gradient-to-b from-[#fbfcfd] to-white px-4 pb-12 pt-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div
          className="absolute bottom-[39px] top-4 rounded-[22px] bg-[#eefbf4]"
          style={{ left: `${selectedLeft}%`, right: `${selectedRight}%` }}
        />
        <div className="absolute inset-x-4 bottom-[48px] flex h-[92px] items-end justify-between gap-1">
          {scale.bars.map((height, index) => {
            const bucketPosition = (index / Math.max(1, scale.bars.length - 1)) * 100;
            const selected = bucketPosition >= selectedLeft && bucketPosition <= 100 - selectedRight;
            return (
              <div
                key={`${height}-${index}`}
                className={`relative flex-1 rounded-full transition-colors ${selected ? "bg-[#0f172a]" : "bg-[#dfe3e8]"}`}
                style={{ height: `${Math.max(8, height)}px`, maxWidth: 8 }}
              />
            );
          })}
        </div>
        <div className="absolute inset-x-4 bottom-[41px] h-1 rounded-full bg-[#dfe3e8]" />
        <div
          className="absolute bottom-[41px] h-1 rounded-full bg-[#0f172a]"
          style={{ left: `${selectedLeft}%`, right: `${selectedRight}%` }}
        />

        <Slider.Root
          className="absolute inset-x-4 bottom-[18px] z-10 flex h-[70px] touch-none select-none items-center"
          min={scale.min}
          max={scale.max}
          step={scale.step}
          minStepsBetweenThumbs={1}
          value={[selectedMin, selectedMax]}
          onValueChange={handleValueChange}
        >
          <Slider.Track className="relative h-1 w-full grow rounded-full bg-transparent">
            <Slider.Range className="absolute h-full rounded-full bg-transparent" />
          </Slider.Track>
          <Slider.Thumb
            aria-label="Minimum price"
            className="relative block h-11 w-11 cursor-grab rounded-full border border-[#d7dde4] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.18)] outline-none transition hover:scale-105 active:cursor-grabbing active:scale-105 focus:ring-4 focus:ring-emerald-100"
          >
            <span className="pointer-events-none absolute -top-11 left-0 whitespace-nowrap rounded-full bg-[#111827] px-3 py-1.5 text-[13px] font-bold text-white shadow-lg">
              €{formatPriceLabel(selectedMin)}
            </span>
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0f172a]" />
          </Slider.Thumb>
          <Slider.Thumb
            aria-label="Maximum price"
            className="relative block h-11 w-11 cursor-grab rounded-full border border-[#d7dde4] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.18)] outline-none transition hover:scale-105 active:cursor-grabbing active:scale-105 focus:ring-4 focus:ring-emerald-100"
          >
            <span className="pointer-events-none absolute -top-11 right-0 whitespace-nowrap rounded-full bg-[#111827] px-3 py-1.5 text-[13px] font-bold text-white shadow-lg">
              €{formatPriceLabel(selectedMax)}{selectedMax >= scale.max ? "+" : ""}
            </span>
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0f172a]" />
          </Slider.Thumb>
        </Slider.Root>
      </div>

      <div className="mt-3 flex items-center justify-between text-[12px] font-semibold text-slate-500">
        <span>€{formatPriceLabel(scale.min)}</span>
        <span>Drag the graph</span>
        <span>€{formatPriceLabel(scale.max)}+</span>
      </div>
    </div>
  );
}

type PriceScale = {
  min: number;
  max: number;
  step: number;
  bars: number[];
  count: number;
  observedMin: number;
  observedMax: number;
};

function buildPriceScale(values: number[]): PriceScale {
  const cleanValues = values.filter((value) => Number.isFinite(value) && value > 0);

  if (cleanValues.length === 0) {
    return {
      min: DEFAULT_PRICE_MIN,
      max: DEFAULT_PRICE_MAX,
      step: DEFAULT_PRICE_STEP,
      bars: EMPTY_PRICE_HISTOGRAM,
      count: 0,
      observedMin: DEFAULT_PRICE_MIN,
      observedMax: DEFAULT_PRICE_MAX,
    };
  }

  const observedMin = Math.min(...cleanValues);
  const observedMax = Math.max(...cleanValues);
  const paddedMax = Math.max(observedMax + Math.max(2, observedMax * 0.25), 10);
  const step = getPriceStep(paddedMax);
  const max = Math.max(step, Math.ceil(paddedMax / step) * step);

  return {
    min: DEFAULT_PRICE_MIN,
    max,
    step,
    bars: buildHistogram(cleanValues, DEFAULT_PRICE_MIN, max),
    count: cleanValues.length,
    observedMin,
    observedMax,
  };
}

function buildHistogram(values: number[], min: number, max: number) {
  if (values.length === 0 || max <= min) return EMPTY_PRICE_HISTOGRAM;
  const counts = Array.from({ length: PRICE_BUCKET_COUNT }, () => 0);

  values.forEach((value) => {
    const ratio = (value - min) / (max - min);
    const bucket = Math.min(PRICE_BUCKET_COUNT - 1, Math.max(0, Math.floor(ratio * PRICE_BUCKET_COUNT)));
    counts[bucket] += 1;
  });

  const maxCount = Math.max(...counts, 1);
  return counts.map((count) => (count === 0 ? 8 : 16 + Math.round((count / maxCount) * 64)));
}

function getPriceStep(max: number) {
  if (max <= 20) return 1;
  if (max <= 80) return 5;
  if (max <= 250) return 10;
  if (max <= 600) return 25;
  return 50;
}

function priceToPercent(value: number, scale: PriceScale) {
  const range = Math.max(1, scale.max - scale.min);
  return ((value - scale.min) / range) * 100;
}

function clampPrice(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatPriceLabel(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}
