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

  if (loading) return <div className="p-4 text-sm text-slate-600">Loading…</div>;

  if (!user) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm text-slate-700">Sign in to manage payments.</p>
        <div className="flex gap-2 text-sm">
          <Link href="/login" className="btn-primary">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
            Create account
          </Link>
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
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand-700">Payments</p>
        <h1 className="text-3xl tracking-tight font-semibold text-slate-900">Manage payment methods</h1>
        <p className="text-sm text-slate-600">Add a card, set a default, and review your booking charges.</p>
      </header>

      {alerts.map((msg) => (
        <div key={msg} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {msg}
        </div>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Saved payment methods</h2>
              <p className="text-sm text-slate-600">Use a card for faster checkout.</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                disabled={!stripePromise}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add card
              </button>
              {!stripePromise ? (
                <span className="text-[11px] text-amber-700">Stripe isn’t configured for web.</span>
              ) : null}
            </div>
          </div>

          {status === "loading" && <div className="text-sm text-slate-600">Loading cards…</div>}
          {methods.length === 0 && status !== "loading" && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
              <div className="grid items-center gap-4 md:grid-cols-[180px_1fr]">
                <div className="mx-auto w-full max-w-[180px]">
                  <Image
                    src="/illustrations/payment-information.svg.png"
                    alt="Payment methods illustration"
                    width={720}
                    height={720}
                    className="h-auto w-full"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-900">No cards saved yet</p>
                  <p className="text-sm text-slate-600">
                    Add a card now so checkout is faster the next time you book a space.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {methods.map((pm) => (
              <div
                key={pm.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-800"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{pm.brand}</span>
                    <span className="text-slate-500">•••• {pm.last4}</span>
                    <span className="text-slate-500">
                      {pm.exp_month}/{pm.exp_year}
                    </span>
                    {pm.is_default && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Default</span>
                    )}
                  </div>
                  {pm.created_at && <p className="text-[11px] text-slate-500">Added {new Date(pm.created_at).toLocaleDateString()}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!pm.is_default && (
                    <button
                      onClick={() => handleDefault(pm.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Make default
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(pm.id)}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Payment history</h2>
              <p className="text-sm text-slate-600">Recent booking charges.</p>
            </div>
          </div>

          {historyStatus === "loading" && <div className="text-sm text-slate-600">Loading payments…</div>}
          {history.length === 0 && historyStatus === "idle" && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
              <div className="grid items-center gap-4 md:grid-cols-[180px_1fr]">
                <div className="mx-auto w-full max-w-[180px]">
                  <Image
                    src="/illustrations/navigation.svg.png"
                    alt="No payments illustration"
                    width={720}
                    height={720}
                    className="h-auto w-full"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-900">No payments recorded yet</p>
                  <p className="text-sm text-slate-600">
                    Once you complete bookings, your recent charges and receipts will show here.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {history.map((p) => (
              <div key={p.id} className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{p.description ?? "Booking payment"}</div>
                  <StatusChip status={p.status} />
                </div>
                <div className="flex items-center justify-between gap-2 text-[12px] text-slate-600">
                  <div className="space-x-2">
                    <span>{new Date(p.created_at).toLocaleString()}</span>
                    {p.booking_id && <span className="text-slate-500">Booking {p.booking_id}</span>}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    €{(p.amount / 100).toFixed(2)} {p.currency?.toUpperCase?.() ?? ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.receipt_url && (
                    <a
                      href={p.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Receipt
                    </a>
                  )}
                  {p.status === "failed" && (
                    <button
                      onClick={() => handleRetry(p.id)}
                      className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {stripePromise ? (
            <AddCardModalStripe
              onClose={() => setShowAdd(false)}
              onAdded={loadMethods}
              setError={setError}
              token={token ?? undefined}
            />
          ) : (
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-brand-700">Add card</p>
                  <p className="text-sm text-slate-600">Stripe is not configured for web.</p>
                </div>
                <button className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setShowAdd(false)}>
                  Close
                </button>
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Card management is unavailable until the web Stripe publishable key is configured.
              </div>
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
    succeeded: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-800",
    failed: "bg-rose-100 text-rose-700",
    refunded: "bg-blue-100 text-blue-700",
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
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-700">Add card</p>
          <p className="text-sm text-slate-600">Securely save a card with Stripe.</p>
        </div>
        <button className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: { fontSize: "15px", color: "#0f172a", "::placeholder": { color: "#94a3b8" } },
            },
          }}
        />
      </div>
      {message && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</div>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={onClose}>
          Cancel
        </button>
        <button
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          onClick={handleSubmit}
        >
          {submitting ? "Saving…" : "Save card"}
        </button>
      </div>
    </div>
  );
}
