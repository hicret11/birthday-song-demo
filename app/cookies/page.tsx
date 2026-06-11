import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { LEGAL_DOCS, loadLegalText } from "@/lib/legal";

export const metadata: Metadata = {
  title: LEGAL_DOCS.cookies.title,
  description: LEGAL_DOCS.cookies.description,
  alternates: { canonical: "/cookies" },
  robots: { index: true, follow: true },
};

export default async function CookiesPage() {
  const text = await loadLegalText("cookies");
  return <LegalDocument slug="cookies" text={text} />;
}
