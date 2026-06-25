"use client";

import Link from "next/link";
import { SlimNav } from "../../../components/SlimNav";
import { SiteFooter } from "../../../components/SiteFooter";

const START = "/host/start";

const STEPS = [
  {
    n: "01",
    title: "List your space",
    body: "Add a few photos, set where it is, and describe access. Most spaces are ready in about five minutes.",
  },
  {
    n: "02",
    title: "Welcome drivers",
    body: "Approve each request yourself, or let trusted drivers book instantly. You decide when it's available.",
  },
  {
    n: "03",
    title: "Get paid",
    body: "Payments are handled automatically and paid to your bank via Stripe after each booking clears.",
  },
];

const BENEFITS = [
  {
    title: "Earn from space you already have",
    body: "Your driveway or spot can make money while you're at work, away, or simply not using it.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    title: "You're in control",
    body: "Set your own price, choose your availability, and decide who can park. Pause any time.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
      </svg>
    ),
  },
  {
    title: "Free to list",
    body: "No upfront cost and no monthly fee. We only take a small cut when you actually earn.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: "Secure payments",
    body: "Every booking is paid through Stripe. You never handle cash, and payouts land in your bank.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 4 5v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V5l-8-3z" /><path d="m9 11 2 2 4-4" />
      </svg>
    ),
  },
];

const TRUST = [
  {
    title: "You approve who parks",
    body: "Review each booking, or switch on instant book only when you're ready.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V5l-8-3z" /><path d="m9 11 2 2 4-4" /></svg>
    ),
  },
  {
    title: "Drivers share their details",
    body: "You see the vehicle and driver behind every booking before they arrive.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
    ),
  },
  {
    title: "Payments through Stripe",
    body: "Money is taken upfront and held securely — no chasing, no cash.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
    ),
  },
  {
    title: "We handle the awkward parts",
    body: "Cancellations, refunds, and support are taken care of for you.",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" /></svg>
    ),
  },
];

export default function HostLandingPage() {
  return (
    <div className="min-h-[100dvh] bg-white antialiased [text-rendering:optimizeLegibility]">
      <SlimNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute -right-24 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-5xl px-6 py-20 sm:py-28 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-400">Become a host</p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[52px]">
            Turn your empty space into income.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.6] text-slate-300">
            List your driveway, garage, or parking spot, set your own price, and start earning from space you&apos;re not using.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3">
            <Link
              href={START}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-8 py-4 text-[16px] font-bold text-white shadow-[0_12px_32px_-12px_rgba(15,169,104,0.6)] transition hover:bg-brand-400"
            >
              Get started
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </Link>
            <p className="text-[13px] font-medium text-slate-400">Free to list · Takes about 5 minutes</p>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-6">

        {/* ── How it works ── */}
        <section className="mt-20 sm:mt-28">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">How it works</p>
            <h2 className="font-display mt-3 text-[26px] font-bold tracking-[-0.02em] text-slate-900 sm:text-[32px]">
              Earning takes three steps
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="font-display text-[40px] font-extrabold leading-none tracking-tight text-slate-200">{s.n}</span>
                <h3 className="font-display mt-4 text-[18px] font-bold tracking-[-0.01em] text-slate-900">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Benefits ── */}
        <section className="mt-20 sm:mt-28">
          <div className="mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">Why host</p>
            <h2 className="font-display mt-3 text-[26px] font-bold tracking-[-0.02em] text-slate-900 sm:text-[32px]">
              A simple way to make your space pay
            </h2>
          </div>
          <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-4">
                <div className="shrink-0 text-brand-600">{b.icon}</div>
                <div>
                  <h3 className="font-display text-[16px] font-bold tracking-[-0.01em] text-slate-900">{b.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-[1.6] text-slate-600">{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Earnings illustration + listing preview ── */}
        <section className="mt-20 grid items-center gap-10 sm:mt-28 lg:grid-cols-[1fr_minmax(0,420px)]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">Your space, live</p>
            <h2 className="font-display mt-3 text-[26px] font-bold tracking-[-0.02em] text-slate-900 sm:text-[32px]">
              You set the price. You keep the most of it.
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-[1.6] text-slate-600">
              There&apos;s no fixed rate — you choose what your space is worth, and even a few days a month adds up.
            </p>
            <div className="mt-6 inline-flex items-baseline gap-3 rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200/70">
              <span className="font-display text-[32px] font-extrabold tracking-[-0.02em] text-slate-900">€144</span>
              <span className="text-[13px] leading-snug text-slate-500">
                Example: €12 / day<br />booked 12 days a month
              </span>
            </div>
            <p className="mt-3 text-[12px] text-slate-400">Just an illustration — you decide your own price and availability.</p>
          </div>

          {/* Listing preview — what drivers will see */}
          <div>
            <div className="mb-4 flex items-stretch gap-2.5">
              <div className="flex flex-1 flex-col justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Today</p>
                <p className="mt-0.5 text-[12.5px] font-semibold text-slate-500">Sitting empty</p>
              </div>
              <div className="flex items-center">
                <svg className="h-4 w-4 shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </div>
              <div className="flex flex-1 flex-col justify-center rounded-2xl bg-brand-50 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">Once listed</p>
                <p className="mt-0.5 text-[12.5px] font-semibold text-brand-700">Bookable by drivers</p>
              </div>
            </div>
            <p className="mb-3 text-[12px] font-semibold text-slate-500">This is how drivers will see your space</p>
            <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.28)]">
              <div className="relative h-44 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80"
                  alt="Example parking space"
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  ⚡ Instant
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[15px] font-bold text-slate-900">
                    Secure driveway near the centre
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[12.5px] text-slate-500">
                    <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="9" r="2.5" /></svg>
                    Dublin city centre
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">from</p>
                  <p className="font-display text-[22px] font-extrabold leading-none tracking-tight text-slate-900">€12</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">per day</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust ── horizontal cards: clean homepage-style icon + text ── */}
        <section className="mt-20 sm:mt-28">
          <div className="mb-9 max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">Hosting with peace of mind</p>
            <h2 className="font-display mt-3 text-[26px] font-bold tracking-[-0.02em] text-slate-900 sm:text-[32px]">
              You stay in control the whole way
            </h2>
          </div>
          <div className="rounded-[28px] border border-slate-200/70 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {TRUST.map((t) => (
                <div key={t.title} className="flex items-start gap-4 rounded-2xl bg-slate-50/70 px-5 py-5 ring-1 ring-slate-200/50">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    {t.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold text-slate-900">{t.title}</h3>
                    <p className="mt-1 text-[13.5px] leading-[1.6] text-slate-600">{t.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── left content + meta row; dark band with brand glow ── */}
        <section className="mb-20 mt-20 sm:mb-28 sm:mt-28">
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-8 py-14 sm:px-12 sm:py-16">
            {/* Right side — real photo if /host-cta.jpg exists, otherwise a soft glow */}
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block">
              <div className="absolute right-[-8%] top-1/4 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
              <div className="absolute inset-0 bg-[url('/host-cta.jpg')] bg-cover bg-center" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />
            </div>

            <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-brand-500/15 blur-3xl" />

            {/* Content */}
            <div className="relative max-w-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/15 text-brand-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
              </span>
              <h2 className="mt-5 font-display text-[30px] font-extrabold tracking-[-0.02em] text-white sm:text-[38px]">
                Ready to start earning?
              </h2>
              <p className="mt-3 text-[15px] leading-[1.6] text-slate-300">
                It&apos;s free to list and takes about five minutes.<br className="hidden sm:block" /> You can pause or change anything later.
              </p>
              <Link
                href={START}
                className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-8 py-4 text-[16px] font-bold text-white shadow-[0_12px_32px_-12px_rgba(15,169,104,0.6)] transition hover:bg-brand-400"
              >
                Get started
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] font-medium text-slate-400">
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.59 11l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83z" /><circle cx="7.5" cy="7.5" r="1" /></svg>
                  Free to list
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  Takes ~5 minutes
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                  Pause anytime
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
