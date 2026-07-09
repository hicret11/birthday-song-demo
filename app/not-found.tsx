import Link from "next/link";
import Image from "next/image";

// Branded 404. Share links carry the whole product, and they can expire (90-day
// KV TTL) or be mistyped — so a dead link must land on a warm, on-brand page
// with a path back into the funnel, not the raw Next.js default.
export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center bg-cream px-6 py-16 text-center">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <Image
          src="/brand/logo-mark-tight.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 drop-shadow-sm"
        />
        <span className="font-display text-lg font-extrabold tracking-tight text-ink">
          Sing My Birthday
        </span>
      </Link>

      <h1 className="max-w-md font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
        This premiere link isn’t available anymore.
      </h1>
      <p className="mt-4 max-w-sm text-base text-ink-soft">
        The song you’re looking for may have expired or the link was mistyped —
        but a brand-new one is only a minute away.
      </p>

      <Link
        href="/generate"
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-jade px-6 py-4 text-base font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(31,142,125,0.7)] transition hover:-translate-y-0.5 hover:bg-jade-deep"
      >
        🎂 Make a birthday song →
      </Link>
    </main>
  );
}
