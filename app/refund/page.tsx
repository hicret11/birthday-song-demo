import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { LEGAL_DOCS, loadLegalText } from "@/lib/legal";

export const metadata: Metadata = {
  title: LEGAL_DOCS.refunds.title,
  description: LEGAL_DOCS.refunds.description,
  alternates: { canonical: "/refund" },
  robots: { index: true, follow: true },
};

export default async function RefundPage() {
  const text = await loadLegalText("refunds");
  return <LegalDocument slug="refunds" text={text} />;
}
