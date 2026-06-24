"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  addPaymentMethod,
  deletePaymentMethod,
  listPaymentHistory,
  listPaymentMethods,
  retryPayment,
  setDefaultPaymentMethod,
} from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import type { PaymentMethod, PaymentHistoryItem } from "../../../types/payments";
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions, type Stripe } from "@stripe/stripe-js";

type LoadingState = "idle" | "loading" | "error";
const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise: Promise<Stripe | null> | null = stripeKey ? loadStripe(stripeKey) : null;

export default function PaymentsPage() {
  const { user, token, loading } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [status, setStatus] = useState<LoadingState>("idle");
  const [historyStatus, setHistoryStatus] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const loadMethods = useMemo(
    () => async () => {
      if (!token) return;
      setStatus("loading");
      setError(null);
      try {
        const data = await listPaymentMethods(token);
        setMethods(data);
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not load payment methods");
      }
    },
    [token]
  );

  const loadHistory = useMemo(
    () => async () => {
      if (!token) return;
      setHistoryStatus("loading");
      try {
        const data = await listPaymentHistory(token);
        setHistory(data);
        setHistoryStatus("idle");
      } catch (err) {
        setHistoryStatus("error");
        // Keep UI clean if history is unavailable
        console.warn("Payments history unavailable:", err);
      }
    },
    [token]
  );

  useEffect(() => {
    loadMethods();
    loadHistory();
  }, [loadMethods, loadHistory]);

  const handleDefault = async (id: string) => {
    if (!token) return;
    try {
      await setDefaultPaymentMethod(id, token);
      loadMethods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set default payment method");
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await deletePaymentMethod(id, token);
      loadMethods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete card");
    }
  };

  const handleRetry = async (id: string) => {
    if (!token) return;
    try {
      await retryPayment(id, token);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>;

  if (!user) {
    return (
      <div className="py-4">
        <p className="text-[14px] text-slate-600">Sign in to manage payments.</p>
        <div className="mt-4 flex flex-col gap-3">
          <Link href="/login" className="flex h-12 items-center justify-center rounded-xl bg-brand-500 text-[15px] font-bold text-white">Sign in</Link>
          <Link href="/signup" className="flex h-12 items-center justify-center rounded-xl border border-slate-200 text-[15px] font-semibold text-slate-700">Create account</Link>
        </div>
      </div>
    );
  }

  const alerts = Array.from(
    new Set(
      [error].filter(Boolean)
    )
  );

  const pageContent = (
    <div className="space-y-4">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">Dashboard</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-slate-900">Payments</h1>
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-slate-900">Saved cards</h2>
          <div className="flex flex-col items-end gap-1">
            <button type="button" onClick={() => setShowAdd(true)} disabled={!stripePromise}
              className="rounded-xl bg-brand-500 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              + Add card
            </button>
            {!stripePromise && <span className="text-[11px] text-amber-600">Stripe not configured.</span>}
          </div>
        </div>
        {status === "loading" ? (
          <div className="mt-4 flex items-center justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
        ) : methods.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-[14px] font-semibold text-slate-700">No cards saved yet</p>
            <p className="mt-1 text-[13px] text-slate-600">Add a card for faster checkout.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {methods.map((pm) => (
              <div key={pm.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">
                    {pm.brand} •••• {pm.last4}
                    {pm.is_default && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">Default</span>}
                  </p>
                  <p className="text-[12px] text-slate-600">Expires {pm.exp_month}/{pm.exp_year}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!pm.is_default && (
                    <button onClick={() => handleDefault(pm.id)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 active:bg-slate-50">
                      Set default
                    </button>
                  )}
                  <button onClick={() => handleDelete(pm.id)}
                    className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600 active:bg-rose-50">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="text-[16px] font-bold text-slate-900">Payment history</h2>
        {historyStatus === "loading" ? (
          <div className="mt-4 flex items-center justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
        ) : history.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-[14px] font-semibold text-slate-700">No payments yet</p>
            <p className="mt-1 text-[13px] text-slate-600">Charges from your bookings will appear here.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {history.map((p) => (
              <div key={p.id} className="py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold text-slate-900">{p.description ?? "Booking payment"}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-slate-900">€{(p.amount / 100).toFixed(2)}</span>
                    <StatusChip status={p.status} />
                  </div>
                </div>
                <p className="mt-0.5 text-[12px] text-slate-600">{new Date(p.created_at).toLocaleString()}</p>
                <div className="mt-2 flex gap-2">
                  {p.receipt_url && (
                    <a href={p.receipt_url} target="_blank" rel="noreferrer"
                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600">
                      Receipt
                    </a>
                  )}
                  {p.status === "failed" && (
                    <button onClick={() => handleRetry(p.id)}
                      className="rounded-full border border-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-700">
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowAdd(false)}>
          {stripePromise ? (
            <AddCardModalStripe onClose={() => setShowAdd(false)} onAdded={loadMethods} setError={setError} token={token ?? undefined} />
          ) : (
            <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <p className="text-[15px] font-bold text-slate-900">Add card</p>
                <button onClick={() => setShowAdd(false)} className="rounded-full border border-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-600">Close</button>
              </div>
              <div className="px-6 py-5 text-[14px] text-slate-600">Stripe is not configured for web payments.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
  if (!stripePromise) return pageContent;
  return (
    <Elements stripe={stripePromise} options={{ appearance: { theme: "stripe" } } as StripeElementsOptions}>
      {pageContent}
    </Elements>
  );
}

function StatusChip({ status }: { status: PaymentHistoryItem["status"] }) {
  const map: Record<PaymentHistoryItem["status"], string> = {
    succeeded: "bg-brand-50 text-brand-700",
    pending: "bg-amber-50 text-amber-700",
    failed: "bg-rose-50 text-rose-700",
    refunded: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

function AddCardModalStripe({
  onClose,
  onAdded,
  setError,
  token,
}: {
  onClose: () => void;
  onAdded: () => void;
  setError: (msg: string | null) => void;
  token?: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!token) return;
    if (!stripe || !elements) {
      setMessage("Stripe is still loading. Please try again.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const intentResp = await addPaymentMethod({ mode: "setup_intent" }, token);
      const clientSecret = intentResp?.clientSecret ?? intentResp?.client_secret ?? intentResp?.setupIntentClientSecret;

      if (!clientSecret) {
        setMessage("Stripe setup could not be started.");
        return;
      }

      const card = elements.getElement(CardElement);
      if (!card) {
        setMessage("Card element unavailable.");
        return;
      }

      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card },
      });
      if (error) {
        setMessage(error.message ?? "Card setup failed.");
        return;
      }

      if (setupIntent?.status === "succeeded") {
        onClose();
        onAdded();
      } else {
        setMessage("Card setup did not complete. Please try again.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to add card");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
      <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <p className="text-[15px] font-bold text-slate-900">Add card</p>
        <button onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-600 active:bg-slate-50">Close</button>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <CardElement options={{ hidePostalCode: true, style: { base: { fontSize: "15px", color: "#0f172a", "::placeholder": { color: "#94a3b8" } } } }} />
        </div>
        {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">{message}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-3 text-[14px] font-semibold text-slate-700 active:bg-slate-50">Cancel</button>
          <button disabled={submitting} onClick={handleSubmit}
            className="flex-1 rounded-xl bg-brand-500 py-3 text-[14px] font-semibold text-white active:bg-brand-600 disabled:opacity-60">
            {submitting ? "Saving…" : "Save card"}
          </button>
        </div>
      </div>
    </div>
  );
}
