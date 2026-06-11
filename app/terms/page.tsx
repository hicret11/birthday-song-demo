import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { LEGAL_DOCS, loadLegalText } from "@/lib/legal";

export const metadata: Metadata = {
  title: LEGAL_DOCS.terms.title,
  description: LEGAL_DOCS.terms.description,
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default async function TermsPage() {
  const text = await loadLegalText("terms");
  return <LegalDocument slug="terms" text={text} />;
}
