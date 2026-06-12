import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { LEGAL_DOCS, loadLegalText } from "@/lib/legal";

export const metadata: Metadata = {
  title: LEGAL_DOCS.privacy.title,
  description: LEGAL_DOCS.privacy.description,
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default async function PrivacyPage() {
  const text = await loadLegalText("privacy");
  return <LegalDocument slug="privacy" text={text} />;
}
