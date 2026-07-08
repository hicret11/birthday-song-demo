import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { email } = await searchParams;
  const displayEmail = typeof email === "string" && email.length > 0 ? email : null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cream px-5 py-16 text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,158,120,0.5),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-0 z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,126,157,0.45),transparent_66%)] blur-2xl"
      />

      <section className="relative z-10 mx-auto w-full max-w-md rounded-3xl border border-sand bg-cream-soft p-8 text-center shadow-sm">
        <h1 className="font-display text-2xl font-extrabold text-ink">Unsubscribe</h1>
        <p className="mt-3 text-sm text-ink-soft">
          {displayEmail ? (
            <>
              We received your unsubscribe request for{" "}
              <code className="rounded bg-sand px-1.5 py-0.5">{displayEmail}</code>. We&apos;ll
              honor it manually. Sorry for the friction — a self-serve flow is coming.
            </>
          ) : (
            <>
              We received your unsubscribe request. We&apos;ll honor it manually. Sorry for the
              friction — a self-serve flow is coming.
            </>
          )}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-2xl border border-sand bg-cream px-5 py-2.5 text-sm font-bold text-ink transition hover:border-jade active:scale-[0.99]"
        >
          Back to home
        </Link>
      </section>
    </main>
  );
}
