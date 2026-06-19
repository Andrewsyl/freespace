"use client";

import Link from "next/link";
import { LEGAL_CONTACT } from "../lib/legal-content";

const navColumns = [
  {
    heading: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Careers", href: "/careers" },
      { label: "News & insights", href: "/blog" },
      { label: "Press centre", href: "/press" },
      { label: "Contact", href: "/contact" },
    ],
  },
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
      { label: "Help / FAQ", href: "/support" },
      { label: "Driver FAQs", href: "/support" },
      { label: "Host FAQs", href: "/support" },
      { label: "Affiliates", href: "/affiliates" },
      { label: "Advertise with us", href: "/advertise" },
      { label: "Partners", href: "/partners" },
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

const socials = [
  {
    label: "Instagram",
    href: "#",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>,
  },
  {
    label: "X",
    href: "#",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
  },
  {
    label: "Facebook",
    href: "#",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
  },
  {
    label: "LinkedIn",
    href: "#",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>,
  },
];

export function SiteFooter() {
  return (
    <footer>

      {/* ── Green CTA strip ── */}
      <div className="bg-brand-600">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-100/80">Your parking platform</p>
            <p className="mt-1.5 font-display text-xl font-bold text-white sm:text-2xl">
              Find your space, stress free.
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
            <div className="flex items-center gap-8">
              <img
                src="/freespace-logo-grid-black.png"
                alt={LEGAL_CONTACT.brandName}
                className="h-14 w-auto brightness-0 invert"
              />
              <div className="flex items-center gap-4">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="text-white/70 transition hover:text-white"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

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
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
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
              <span>© 2026 {LEGAL_CONTACT.brandName}</span>
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
