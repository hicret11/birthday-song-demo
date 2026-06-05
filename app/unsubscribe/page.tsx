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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] px-5 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(168,85,247,0.18),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(236,72,153,0.16),transparent_55%)]" />

      <section className="relative z-10 mx-auto w-full max-w-md rounded-3xl border border-white/15 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-2xl">
        <h1 className="text-2xl font-extrabold">Unsubscribe</h1>
        <p className="mt-3 text-sm text-gray-300">
          {displayEmail ? (
            <>
              We received your unsubscribe request for{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5">{displayEmail}</code>. We'll
              honor it manually. Sorry for the friction — a self-serve flow is coming.
            </>
          ) : (
            <>
              We received your unsubscribe request. We'll honor it manually. Sorry for the
              friction — a self-serve flow is coming.
            </>
          )}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-bold transition hover:bg-white/15"
        >
          Back to home
        </Link>
      </section>
    </main>
  );
}
