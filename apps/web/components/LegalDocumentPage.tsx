import Link from "next/link";
import { LEGAL_CONTACT, LEGAL_DOCS, type LegalDoc } from "../lib/legal-content";

export function LegalDocumentPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
          ← Back to FreeSpace
        </Link>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">Legal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {doc.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{doc.summary}</p>

          <div className="mt-10 space-y-8">
            {doc.sections.map((section) => (
              <section key={section.heading} className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-slate-600 sm:text-[15px]">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="space-y-2 pl-5 text-sm leading-7 text-slate-600 sm:text-[15px]">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="list-disc">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Company and support
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
            <p className="mt-4 text-xs leading-6 text-slate-500">
              Replace the registered business name and address above with the exact legal entity and registered office details before public launch.
            </p>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Related policies
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {LEGAL_DOCS.filter((item) => item.slug !== doc.slug).map((item) => (
                <Link
                  key={item.slug}
                  href={`/legal/${item.slug}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
