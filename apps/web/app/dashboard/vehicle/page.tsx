"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import { updateMe } from "../../../lib/api";

function formatIrishPlate(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";
  const firstLetter = compact.search(/[A-Z]/);
  if (firstLetter === -1) return compact.slice(0, 11);
  const year   = compact.slice(0, firstLetter).slice(0, 3);
  const after  = compact.slice(firstLetter);
  const county = (after.match(/[A-Z]/g) ?? []).join("").slice(0, 2);
  const serial = after.replace(/[A-Z]/g, "").slice(0, 6);
  if (!year)   return compact.slice(0, 11);
  if (!county) return year;
  if (!serial) return `${year}-${county}`;
  return `${year}-${county}-${serial}`;
}

export default function VehiclePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-white"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
      <VehiclePageContent />
    </Suspense>
  );
}

function VehiclePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") ?? "/dashboard";
  const { user, token, setUser } = useAuth();

  const [plate,  setPlate]  = useState(user?.vehiclePlate ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const saved = plate.trim().toUpperCase() || null;
      await updateMe(token, { vehiclePlate: saved });
      if (user) setUser({ ...user, vehiclePlate: saved });
      router.push(next as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vehicle");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav bar */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <button
          type="button"
          onClick={() => router.push(next as any)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-800 active:bg-slate-100"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <p className="text-[15px] font-semibold text-slate-900">My vehicle</p>
        <div className="w-9" />
      </div>

      {/* Page header */}
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Vehicle profile</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Registration plate</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">Your plate is shown to hosts when you park.</p>
      </div>

      <div className="px-5 py-6">
        {/* Irish plate input */}
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Reg plate</p>
        <div className="flex overflow-hidden rounded-lg border-2 border-slate-900 shadow-sm">
          {/* Blue EU band */}
          <div className="w-9 shrink-0 bg-[#003399]" />
          <input
            type="text"
            value={plate}
            onChange={(e) => setPlate(formatIrishPlate(e.target.value))}
            placeholder="221-D-12345"
            className="flex-1 bg-[#FAFAF8] px-4 py-3.5 text-[20px] font-bold uppercase tracking-[0.1em] text-slate-900 outline-none placeholder:text-[15px] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400"
            maxLength={14}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>
        <p className="mt-2 text-[12px] text-slate-400">Format: 221-D-12345</p>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-6 flex h-[52px] w-full items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white disabled:opacity-50 active:bg-brand-600"
        >
          {saving ? "Saving…" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => router.push(next as any)}
          className="mt-3 flex h-11 w-full items-center justify-center text-[14px] font-semibold text-slate-500"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
