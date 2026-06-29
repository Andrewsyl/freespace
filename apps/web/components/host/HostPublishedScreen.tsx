"use client";

import { motion } from "framer-motion";
import { Check, Wallet } from "lucide-react";
import { ListingPreviewCard } from "./ListingPreviewCard";
import type { HostListingDraft } from "./types";

export function HostPublishedScreen({
  data,
  onDashboard,
  onAddAnother,
}: {
  data: HostListingDraft;
  onDashboard: () => void;
  onAddAnother: () => void;
}) {
  const parts = (data.address ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const area = parts.slice(1).join(", ") || parts[0] || "your area";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-5 py-12">
      <div className="w-full max-w-[400px] text-center">

        {/* Celebration mark */}
        <motion.div
          initial={{ scale: 0, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/25"
        >
          <Check className="h-8 w-8" strokeWidth={3} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.18 }}
        >
          <h1 className="mt-6 text-[30px] font-extrabold tracking-[-0.02em] text-slate-900">
            You&rsquo;re live! 🎉
          </h1>
          <p className="mx-auto mt-2 max-w-[34ch] text-[15px] leading-relaxed text-slate-500">
            Your space is now visible to drivers in {area}. We&rsquo;ll email you the moment someone books.
          </p>
        </motion.div>

        {/* The listing they just created */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8 text-left"
        >
          <ListingPreviewCard data={data} />
        </motion.div>

        {/* One thing left — frame payouts as a known step, not a surprise banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3.5 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100">
            <Wallet className="h-4 w-4 text-brand-700" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[13.5px] font-bold text-brand-900">Get paid for bookings</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-brand-700/90">
              Connect or confirm your payout details in the dashboard so earnings reach your bank automatically.
            </p>
          </div>
        </motion.div>

        {/* Next actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="mt-5 flex flex-col gap-3"
        >
          <button
            type="button"
            onClick={onDashboard}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 text-[15px] font-bold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:scale-[0.99]"
          >
            Go to your dashboard
          </button>
          <button
            type="button"
            onClick={onAddAnother}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            List another space
          </button>
        </motion.div>
      </div>
    </div>
  );
}
