import { MapPin, Cctv, Zap, Lock, Home } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { formatPriceValue } from "../lib/pricing";
import { deriveFeatureKeys } from "./amenityFeatures";

export type AvailabilityScheduleEntry = {
  id: string;
  kind: "open" | "blocked";
  startsAt: string;
  endsAt: string;
  repeatWeekdays?: number[] | null;
  repeatUntil?: string | null;
};

export type Listing = {
  id: string;
  title: string;
  address: string;
  pricePerDay: number;
  pricePerHour?: number | null;
  pricePerMonth?: number | null;
  rateType?: "hourly" | "daily" | null;
  rating?: number;
  ratingCount?: number;
  distanceKm?: number;
  availability: string;
  tags?: string[];
  amenities?: string[];
  image?: string;
  imageUrls?: string[];
  image_urls?: string[];
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
  availabilitySchedule?: AvailabilityScheduleEntry[] | null;
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function ListingCardSkeleton() {
  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="w-[160px] shrink-0 animate-pulse bg-slate-100" style={{ minHeight: 136 }} />
      <div className="flex flex-1 flex-col justify-between px-4 py-3.5">
        <div className="h-4 w-20 animate-pulse rounded-full bg-slate-100" />
        <div>
          <div className="h-[17px] w-4/5 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="flex w-[116px] shrink-0 flex-col justify-between border-l border-slate-100 px-3.5 py-3.5">
        <div className="space-y-1.5">
          <div className="h-2.5 w-8 animate-pulse rounded-full bg-slate-100" />
          <div className="h-6 w-14 animate-pulse rounded-full bg-slate-100" />
          <div className="h-2.5 w-10 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

// ── Space type normaliser ─────────────────────────────────────────────────────

const SPACE_TYPE_KEYS = [
  ["car park", "Car park"],
  ["carpark", "Car park"],
  ["garage", "Garage"],
  ["driveway", "Driveway"],
  ["private road", "Private road"],
  ["on-street", "On-street"],
  ["on street", "On-street"],
  ["underground", "Underground"],
] as const;

function deriveSpaceType(tags?: string[]): string | undefined {
  if (!tags?.length) return undefined;
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [key, label] of SPACE_TYPE_KEYS) {
      if (lower.includes(key)) return label;
    }
  }
  return undefined;
}

// ── Feature icon ──────────────────────────────────────────────────────────────

function FeatureIcon({ type }: { type: "cctv" | "ev" | "gated" | "covered" | "instant" }) {
  if (type === "instant") return (
    <span title="Instant book" className="flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700">
      ⚡ Instant
    </span>
  );
  const Icon = type === "cctv" ? Cctv : type === "ev" ? Zap : type === "gated" ? Lock : Home;
  const label = type === "cctv" ? "CCTV" : type === "ev" ? "EV charging" : type === "gated" ? "Gated" : "Covered";
  return (
    <span title={label} className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      <Icon className="h-3 w-3" strokeWidth={2.2} />
    </span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function ListingCard({
  listing,
  onSelect,
  suppressNavigation = false,
  selected = false,
  searchMode = "daily",
  priceDisplay,
}: {
  listing: Listing;
  onSelect?: (listing: Listing) => void;
  suppressNavigation?: boolean;
  selected?: boolean;
  searchMode?: "daily" | "monthly";
  priceDisplay?: {
    eyebrow: string;
    value: number;
    suffix: string;
  };
}) {
  const handleSelect = (e: React.MouseEvent) => {
    if (!onSelect) return;
    e.preventDefault();
    onSelect(listing);
  };

  const streetViewKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  const streetViewImage =
    listing.latitude != null && listing.longitude != null && streetViewKey
      ? `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${listing.latitude},${listing.longitude}&source=outdoor&key=${streetViewKey}`
      : undefined;

  const imageSrc =
    (listing.imageUrls ?? listing.image_urls)?.[0] ??
    listing.image ??
    streetViewImage ??
    "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80";

  const hasRating = typeof listing.rating === "number" && listing.rating > 0;
  const isVerified = hasRating && (listing.ratingCount ?? 0) >= 1;
  const dist = listing.distanceKm;

  const isInstantBook = [...(listing.amenities ?? []), ...(listing.tags ?? [])]
    .some((f) => f.toLowerCase().includes("instant"));
  const features = deriveFeatureKeys([...(listing.amenities ?? []), ...(listing.tags ?? [])], listing.title);

  const spaceType = deriveSpaceType(listing.tags);
  const defaultPriceDisplay =
    searchMode === "monthly" && typeof listing.pricePerMonth === "number" && listing.pricePerMonth > 0
      ? { eyebrow: "from", value: listing.pricePerMonth, suffix: "per month" }
      : { eyebrow: "from", value: listing.pricePerDay, suffix: "per day" };
  const finalPriceDisplay = priceDisplay ?? defaultPriceDisplay;

  return (
    <article
      className={clsx(
        "group flex items-stretch overflow-hidden rounded-xl border bg-white transition-all duration-200",
        selected
          ? "border-brand-400 shadow-[0_0_0_3px_rgba(22,163,74,0.12),0_4px_16px_rgba(15,23,42,0.10)] ring-0"
          : "border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-[0_4px_20px_rgba(15,23,42,0.10)] hover:-translate-y-px"
      )}
    >
      {/* ── Image — full card height ── */}
      <div className="relative w-[160px] shrink-0 overflow-hidden">
        <Image
          src={imageSrc}
          alt={listing.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          sizes="160px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        {isInstantBook && (
          <span className="absolute left-2 top-2 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            ⚡ Instant
          </span>
        )}
      </div>

      {/* ── Middle: title, address, badges ── */}
      <div className="flex min-w-0 flex-1 flex-col justify-between px-4 py-3.5">
        {/* Top badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {spaceType && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {spaceType}
            </span>
          )}
          {isVerified && (
            <span className="flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-.522 3.772 3.745 3.745 0 01-3.572 1.521 3.745 3.745 0 01-3.068 1.593c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.772-.522 3.745 3.745 0 01-1.521-3.572A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 01.522-3.772 3.745 3.745 0 013.572-1.521A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.772.522 3.745 3.745 0 011.521 3.572A3.745 3.745 0 0121 12z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Verified
            </span>
          )}
        </div>

        {/* Title + address */}
        <div className="mt-2">
          <Link
            href={`/listing/${listing.id}`}
            onClick={suppressNavigation ? (e) => e.preventDefault() : undefined}
            className="line-clamp-1 text-[14.5px] font-bold leading-snug text-slate-900 transition-colors hover:text-brand-600"
          >
            {listing.title}
          </Link>
          <p className="mt-1 flex items-center gap-1 text-[12px] text-slate-500">
            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="line-clamp-1">{listing.address}</span>
          </p>
        </div>

        {/* Bottom row: feature icons + rating + distance */}
        <div className="mt-2.5 flex items-center gap-1.5">
          {features.map((feature) => (
            <FeatureIcon key={feature} type={feature} />
          ))}

          <div className="ml-auto flex items-center gap-2.5">
            {hasRating && (
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-brand-700">
                <svg className="h-3 w-3 fill-brand-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {listing.rating!.toFixed(1)}
                {(listing.ratingCount ?? 0) > 0 && (
                  <span className="font-normal text-slate-500">({listing.ratingCount})</span>
                )}
              </span>
            )}
            {dist !== undefined && (
              <span className="text-[11px] font-medium text-slate-500">{dist.toFixed(1)} km</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: price + CTA ── */}
      <div className="flex w-[116px] shrink-0 flex-col items-stretch justify-between border-l border-slate-100 px-3.5 py-3.5">
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{finalPriceDisplay.eyebrow}</p>
          <p className="mt-0.5 text-[23px] font-extrabold leading-none tracking-tight text-slate-900">
            €{formatPriceValue(finalPriceDisplay.value)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">{finalPriceDisplay.suffix}</p>
        </div>
        <Link
          href={`/checkout/${listing.id}`}
          onClick={suppressNavigation ? handleSelect : undefined}
          className="mt-3 block rounded-xl bg-brand-500 py-2.5 text-center text-[13px] font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 active:shadow-none"
        >
          Reserve
        </Link>
      </div>
    </article>
  );
}
