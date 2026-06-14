import type { Metadata } from "next";
import BecomeAVenueClient from "./BecomeAVenueClient";

const TITLE = "Become a Founding Venue";
const DESCRIPTION =
  "Stand out for your guests on their birthday. Get a branded venue link, your color in the song flow, and attribution on every share for $299/month.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/become-a-venue" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/become-a-venue",
    siteName: "Sing My Birthday",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function BecomeAVenuePage() {
  return <BecomeAVenueClient />;
}
