"use client";

import Link from "next/link";
import { LEGAL_CONTACT } from "../lib/legal-content";

const navColumns = [
  {
    heading: "Parking",
    links: [
      { label: "Find parking", href: "/" },
      { label: "Airport parking", href: "/?location=Airport&lat=53.4264&lng=-6.2499&mode=daily" },
      { label: "Monthly parking", href: "/?mode=monthly" },
      { label: "Event parking", href: "/?location=Aviva+Stadium&lat=53.3352&lng=-6.2285&mode=daily" },
      { label: "EV charging", href: "/?ev=true" },
      { label: "Host your space", href: "/host" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Help & FAQ", href: "/support" },
      { label: "Contact us", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms & conditions", href: "/legal/terms-of-service" },
      { label: "Privacy policy", href: "/legal/privacy-policy" },
      { label: "Cookie policy", href: "/legal/cookie-policy" },
      { label: "Refund policy", href: "/legal/refund-cancellation-policy" },
      { label: "Host terms", href: "/legal/host-terms" },
      { label: "All policies", href: "/legal" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer>

      {/* ── Green CTA strip ── */}
      <div className="bg-brand-600">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-100/80">Ready when you are</p>
            <p className="mt-1.5 font-display text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">
              Your space is waiting.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="shrink-0 self-start rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50 sm:self-auto"
          >
            Find a space →
          </button>
        </div>
      </div>

      {/* ── Dark section ── */}
      <div className="bg-slate-900">

        {/* Brand row */}
        <div className="mx-auto max-w-6xl border-b border-white/[0.06] px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <img
              src="/freespace-logo-grid-black.png"
              alt={LEGAL_CONTACT.brandName}
              className="h-14 w-auto brightness-0 invert"
            />

          {/* App store buttons */}
            <div className="flex items-center gap-3">
              <span aria-label="Download on the App Store" className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/20 bg-white/[0.04] px-3.5 py-2">
                <svg className="h-5 w-5 shrink-0 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div>
                  <p className="text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-brand-200">Coming soon</p>
                  <p className="mt-0.5 text-[12px] font-semibold leading-none text-white">App Store</p>
                </div>
              </span>
              <span aria-label="Get it on Google Play" className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/20 bg-white/[0.04] px-3.5 py-2">
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M3.18 23.76c.37.2.8.22 1.2.04l12.44-7.08-2.79-2.8L3.18 23.76z" fill="#EA4335" />
                  <path d="M20.82 10.26 17.7 8.46l-3.13 3.12 3.13 3.12 3.14-1.82a1.6 1.6 0 000-2.62z" fill="#FBBC04" />
                  <path d="M4.38.2C3.98.02 3.55.04 3.18.28L14.07 11.2l2.79-2.79L4.38.2z" fill="#4285F4" />
                  <path d="M3.18.28C2.76.56 2.5 1.04 2.5 1.62v20.76c0 .58.26 1.06.68 1.38L14.07 12.8 3.18.28z" fill="#34A853" />
                </svg>
                <div>
                  <p className="text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-brand-200">Coming soon</p>
                  <p className="mt-0.5 text-[12px] font-semibold leading-none text-white">Google Play</p>
                </div>
              </span>
            </div>
          </div>
        </div>

        {/* Nav columns */}
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {navColumns.map((col) => (
              <div key={col.heading}>
                <h3 className="pb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
                  {col.heading}
                </h3>
                <ul className="space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href as any} className="text-[13px] font-medium text-white/85 transition hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.06]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 text-[12px] text-white/70">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span>© {new Date().getFullYear()} {LEGAL_CONTACT.brandName}</span>
              {[
                { label: "Cookie settings", href: "/legal/cookie-policy" },
                { label: "Privacy", href: "/legal/privacy-policy" },
                { label: "Accessibility", href: "/legal/accessibility" },
                { label: "Terms", href: "/legal/terms-of-service" },
              ].map((l) => (
                <Link key={l.label} href={l.href as any} className="transition hover:text-white/70">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <button type="button" className="flex items-center gap-1.5 transition hover:text-white/60">
                🇮🇪 Ireland (English)
              </button>
              <button type="button" className="transition hover:text-white/60">€ EUR</button>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
