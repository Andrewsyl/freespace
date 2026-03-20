import Link from "next/link";
import { LEGAL_CONTACT, LEGAL_DOCS } from "../lib/legal-content";

const primaryDocs = [
  "terms-of-service",
  "privacy-policy",
  "cookie-policy",
  "refund-cancellation-policy",
  "host-terms",
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/90">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{LEGAL_CONTACT.brandName}</h2>
          <p className="mt-3 max-w-sm leading-7">
            Find, book, and manage parking with clear pricing, real-time availability, and host-friendly tools.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">Legal</h3>
          <ul className="mt-3 space-y-2">
            {primaryDocs.map((slug) => {
              const doc = LEGAL_DOCS.find((item) => item.slug === slug);
              if (!doc) return null;
              return (
                <li key={doc.slug}>
                  <Link href={`/legal/${doc.slug}`} className="hover:text-slate-900">
                    {doc.title}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link href="/legal" className="font-medium text-emerald-700 hover:text-emerald-800">
                View all policies
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">Support and company</h3>
          <ul className="mt-3 space-y-2">
            <li>
              <a href={`mailto:${LEGAL_CONTACT.supportEmail}`} className="hover:text-slate-900">
                {LEGAL_CONTACT.supportEmail}
              </a>
            </li>
            <li>{LEGAL_CONTACT.registeredName}</li>
            <li>{LEGAL_CONTACT.registeredAddress}</li>
          </ul>
          <p className="mt-4 text-xs leading-6 text-slate-500">
            Replace the registered business details above with the exact launch entity before going live.
          </p>
        </div>
      </div>
    </footer>
  );
}
