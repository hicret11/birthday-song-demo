import Link from "next/link";
import {
  LEGAL_DOCS,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_ENTITY,
  LEGAL_VERSION,
  type LegalDocSlug,
} from "@/lib/legal";

type LegalDocumentProps = {
  slug: LegalDocSlug;
  text: string;
};

function paragraphsFromText(text: string): string[] {
  return text
    .replace(/\f/g, "\n\n")
    .split(/\n{2,}/)
    .map((part) => part.replace(/[ \t]+\n/g, "\n").trim())
    .filter(Boolean);
}

export default function LegalDocument({ slug, text }: LegalDocumentProps) {
  const doc = LEGAL_DOCS[slug];
  const paragraphs = paragraphsFromText(text);

  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-10 text-[#1f2937] sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex text-sm font-semibold text-purple-700 transition hover:text-purple-900"
        >
          Back to Sing My Birthday
        </Link>

        <header className="mt-8 border-b border-gray-200 pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
            Legal
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl">
            {doc.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-gray-600">{doc.description}</p>

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <dt className="font-bold text-gray-950">Version</dt>
              <dd className="mt-1 text-gray-700">{LEGAL_VERSION}</dd>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <dt className="font-bold text-gray-950">Effective date</dt>
              <dd className="mt-1 text-gray-700">{LEGAL_EFFECTIVE_DATE}</dd>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <dt className="font-bold text-gray-950">Entity</dt>
              <dd className="mt-1 text-gray-700">{LEGAL_ENTITY}</dd>
            </div>
          </dl>
        </header>

        <div className="mt-8 space-y-5 text-sm leading-7 text-gray-800 sm:text-base">
          {paragraphs.map((paragraph, index) => (
            <p key={`${slug}-${index}`} className="whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
        </div>
      </article>
    </main>
  );
}
