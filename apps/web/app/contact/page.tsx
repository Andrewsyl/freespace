import Link from "next/link";
import { SlimNav } from "../../components/SlimNav";
import { LEGAL_CONTACT } from "../../lib/legal-content";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <SlimNav />
      <div className="mx-auto max-w-3xl">

      <div className="border-b border-slate-200 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Support</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Contact FreeSpace</h1>
        <p className="mt-1 text-[14px] text-slate-500">
          For booking issues, refunds, and account questions.
        </p>
      </div>

      <section className="border-b border-slate-200 px-6 py-6">
        <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Email support</h2>
        <p className="mt-3 text-[14px] leading-6 text-slate-600">
          For urgent issues, email support with your booking reference, listing title, and a description of what happened.
        </p>
        <a href={`mailto:${LEGAL_CONTACT.supportEmail}`}
          className="mt-4 inline-flex items-center justify-center rounded-2xl bg-brand-500 px-5 py-2.5 text-[14px] font-semibold text-white active:bg-brand-600">
          {LEGAL_CONTACT.supportEmail}
        </a>
      </section>

      <section className="px-6 py-6">
        <h2 className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Common requests</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {[
            "Refund request",
            "Could not access the space",
            "Booking charged but not confirmed",
            "Host cancellation or arrival issue",
            "Account access or verification problem",
          ].map((item) => (
            <p key={item} className="py-3 text-[14px] text-slate-600">{item}</p>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-slate-400">
          You can also review our{" "}
          <Link href="/legal/refund-cancellation-policy" className="font-semibold text-brand-600 underline underline-offset-2">
            refund and cancellation policy
          </Link>.
        </p>
      </section>
      </div>
    </div>
  );
}
