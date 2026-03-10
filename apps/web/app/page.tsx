import { ListingCard, type Listing } from "../components/ListingCard";
import { SearchForm } from "../components/SearchForm";

const sampleListings: Listing[] = [
  {
    id: "1",
    title: "Secure driveway near downtown",
    address: "City Centre",
    pricePerDay: 18,
    rating: 4.9,
    distanceKm: 2.1,
    availability: "Today • 7am - 10pm",
    tags: ["EV charging", "CCTV"],
  },
  {
    id: "2",
    title: "Covered garage near the river",
    address: "Riverside",
    pricePerDay: 24,
    rating: 4.8,
    distanceKm: 0.8,
    availability: "Today • 24/7",
    tags: ["Gated", "Keypad access"],
  },
  {
    id: "3",
    title: "Driveway beside transit stop",
    address: "North District",
    pricePerDay: 16,
    rating: 4.7,
    distanceKm: 3.4,
    availability: "Today • 8am - 8pm",
    tags: ["Well lit"],
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10 sm:space-y-12">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white px-6 py-10 shadow-card sm:px-10">
        <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-52 w-52 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip">Instant confirmation</span>
              <span className="chip">Secure payments</span>
              <span className="chip">Verified hosts</span>
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              FreeSpace helps you park with confidence.
            </h1>
            <p className="max-w-xl text-base text-slate-600 sm:text-lg">
              Find a space that fits your schedule and pay in seconds. Home driveways, garages, and
              commercial lots all in one place.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="/search" className="btn-primary px-6 py-3 text-sm">
                Find parking
              </a>
              <a
                href="/host"
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
              >
                List your space
              </a>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-inner">
            <SearchForm redirectToSearch />
            <div className="mt-3 text-xs text-slate-500">Pick a location, time, and radius.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="3 min to book" detail="Search, select, pay—no calls or approvals." />
        <StatCard title="Live availability" detail="Calendars lock once you pay, no double bookings." />
        <StatCard title="Host payouts" detail="Stripe-powered payouts for hosts, automated." />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Popular today</p>
            <h2 className="text-2xl font-semibold text-slate-900">Spaces people book fast</h2>
          </div>
          <a href="/search" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            Browse all
          </a>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {sampleListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} suppressNavigation />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </div>
  );
}
