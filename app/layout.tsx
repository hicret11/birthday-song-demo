import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Bricolage_Grotesque, Instrument_Serif } from "next/font/google";
import CookieConsent from "@/components/CookieConsent";
import SiteFooter from "@/components/SiteFooter";
import GlobalThemeToggle from "@/components/GlobalThemeToggle";
import { DEFAULT_LOCALE, isRtl } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/server";
import "./globals.css";

// Body / UI text — warm, highly legible geometric sans.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

// Display / headlines — characterful modern grotesque with real personality.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

// Editorial accent — the elegant italic serif used for a word or two.
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://singmybirthday.com"),
  title: {
    default: "Sing My Birthday",
    template: "%s — Sing My Birthday",
  },
  description:
    "Personalized birthday songs, made for the people you love. In any language. In about a minute.",
  // Bump ?v=N whenever the favicon source changes so browsers (especially
  // Safari, which caches favicons aggressively) refetch instead of serving
  // the stale cached icon.
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "32x32" },
      { url: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    apple: {
      url: "/apple-touch-icon.png?v=2",
      sizes: "180x180",
      type: "image/png",
    },
  },
  openGraph: {
    title: "Sing My Birthday",
    description:
      "Personalized birthday songs, made for the people you love. In any language. In about a minute.",
    siteName: "Sing My Birthday",
    type: "website",
    images: [
      {
        url: "/og-image.png?v=1",
        width: 1200,
        height: 630,
        alt: "Sing My Birthday — Personalized birthday songs in any language",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sing My Birthday",
    description:
      "Personalized birthday songs, made for the people you love.",
    images: ["/og-image.png?v=1"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reflects the cookie/Accept-Language locale. The `?lang=` query override is
  // applied per-page (e.g. the landing) and not visible here, which is fine.
  const locale = await resolveLocale().catch(() => DEFAULT_LOCALE);

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      // The no-flash theme script adds the `dark` class to <html> before React
      // hydrates, so the server/client class attribute intentionally differs.
      suppressHydrationWarning
      className={`${jakarta.variable} ${bricolage.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* No-flash theme init: apply the saved theme before first paint. Light
            is the default; dark only when the user explicitly switched to it. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();",
          }}
        />
        {/* Site-wide light/dark switch (skips pages that place their own). */}
        <GlobalThemeToggle />
        {children}
        <SiteFooter />
        {/* Vercel Analytics is mounted inside CookieConsent, behind the
            Analytics consent category — never before consent. */}
        <CookieConsent />
      </body>
    </html>
  );
}
