import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import CookieConsent from "@/components/CookieConsent";
import SiteFooter from "@/components/SiteFooter";
import { DEFAULT_LOCALE, isRtl } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
        {/* Vercel Analytics is mounted inside CookieConsent, behind the
            Analytics consent category — never before consent. */}
        <CookieConsent />
      </body>
    </html>
  );
}
