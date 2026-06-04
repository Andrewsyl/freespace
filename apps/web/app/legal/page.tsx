import Link from "next/link";
import { LEGAL_CONTACT, LEGAL_DOCS } from "../../lib/legal-content";

export default function LegalIndexPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
          ← Back to FreeSpace
        </Link>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">Legal and support</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Policies, terms, and operating rules
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            These documents cover marketplace usage, privacy, refunds, host obligations, parking rules, and site enforcement.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {LEGAL_DOCS.map((doc) => (
              <Link
                key={doc.slug}
                href={`/legal/${doc.slug}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white"
              >
                <h2 className="text-lg font-semibold text-slate-900">{doc.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{doc.summary}</p>
              </Link>
            ))}
          </div>

          <div className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
              Company details
            </h2>
            <div className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
              <div>
                <p className="font-semibold text-slate-900">Brand</p>
                <p>{LEGAL_CONTACT.brandName}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Support</p>
                <a href={`mailto:${LEGAL_CONTACT.supportEmail}`} className="text-emerald-700 hover:text-emerald-800">
                  {LEGAL_CONTACT.supportEmail}
                </a>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Registered business</p>
                <p>{LEGAL_CONTACT.registeredName}</p>
                <p>{LEGAL_CONTACT.registeredAddress}</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-600">
              Replace the registered business name and address above with the exact legal entity and registered office details before public launch.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
