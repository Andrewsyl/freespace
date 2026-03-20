import { notFound } from "next/navigation";
import { LegalDocumentPage } from "../../../components/LegalDocumentPage";
import { getLegalDoc, LEGAL_DOCS } from "../../../lib/legal-content";

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ slug: doc.slug }));
}

export default async function LegalDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();
  return <LegalDocumentPage doc={doc} />;
}
