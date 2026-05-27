import Link from "next/link";
import { LEGAL_CONTACT } from "../../lib/legal-content";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Support
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
            Contact FreeSpace
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Use this page for booking issues, refunds, access problems, and account questions.
            Include your booking reference where possible.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Email support</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              For urgent booking issues, refunds, or account questions, email support with your
              booking reference, listing title, and what happened.
            </p>
            <a
              href={`mailto:${LEGAL_CONTACT.supportEmail}`}
              className="mt-5 inline-flex rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {LEGAL_CONTACT.supportEmail}
            </a>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Common request types</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Refund request</li>
              <li>Could not access the space</li>
              <li>Booking charged but not confirmed</li>
              <li>Host cancellation or arrival issue</li>
              <li>Account access or verification problem</li>
            </ul>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              You can also review our{" "}
              <Link href="/legal/refund-cancellation-policy" className="font-medium text-emerald-700">
                refund and cancellation policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
