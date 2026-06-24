import { CalendarDays, CarFront, MapPin, Phone, UserRound } from "lucide-react";

export type Booking = {
  id: string;
  listingId?: string;
  address: string;
  title?: string;
  date: string;
  timeRange: string;
  payout?: number;
  role: "driver" | "host";
  driver?: string;
  vehiclePlate?: string | null;
  vehicleSummary?: string | null;
  driverPhone?: string | null;
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  status: "pending" | "confirmed" | "canceled" | "upcoming" | "completed";
  refundStatus?: string | null;
  refundedAt?: string | null;
  noShowAt?: string | null;
  cancellationSource?: "driver" | "host" | null;
  startTime?: string;
  endTime?: string;
};

const STATUS_STYLE: Record<Booking["status"], { bar: string; badge: string; label: string }> = {
  pending:   { bar: "bg-amber-400",   badge: "bg-amber-50 text-amber-700",     label: "Pending"   },
  confirmed: { bar: "bg-brand-500",   badge: "bg-brand-50 text-brand-700",     label: "Confirmed" },
  upcoming:  { bar: "bg-blue-400",    badge: "bg-blue-50 text-blue-700",       label: "Upcoming"  },
  completed: { bar: "bg-slate-300",   badge: "bg-slate-100 text-slate-600",    label: "Completed" },
  canceled:  { bar: "bg-rose-300",    badge: "bg-rose-50 text-rose-600",       label: "Cancelled" },
};

export function BookingCard({ booking }: { booking: Booking }) {
  const { bar, badge, label } = STATUS_STYLE[booking.status] ?? STATUS_STYLE.pending;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Colour bar */}
      <div className={`h-1 w-full ${bar}`} />

      <div className="px-5 py-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-bold text-slate-900">
              {booking.title ?? booking.address}
            </p>
            {booking.title && (
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-slate-500">
                <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} />
                <span className="truncate">{booking.address}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge}`}>
              {label}
            </span>
            {typeof booking.payout === "number" && booking.payout > 0 && (
              <span className="text-[13px] font-bold text-slate-900">€{booking.payout.toFixed(2)}</span>
            )}
          </div>
        </div>

        {/* Date / time */}
        <div className="mt-3 flex items-center gap-2 text-[12.5px] text-slate-600">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
          <span>{booking.date} · {booking.timeRange}</span>
        </div>

        {/* Host-role: driver details */}
        {booking.role === "host" && (
          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
            {booking.driver && (
              <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                <span>{booking.driver}</span>
              </div>
            )}
            {(booking.vehiclePlate || booking.vehicleSummary) && (
              <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <CarFront className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                <span>
                  {booking.vehicleSummary ? `${booking.vehicleSummary} · ` : ""}
                  {booking.vehiclePlate ?? "Vehicle"}
                </span>
              </div>
            )}
            {booking.driverPhone && (
              <div className="flex items-center gap-2 text-[12.5px]">
                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                <a href={`tel:${booking.driverPhone}`} className="font-semibold text-brand-600 hover:text-brand-700">
                  {booking.driverPhone}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
