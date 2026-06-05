import type { Metadata } from "next";
import BecomeAVenueClient from "./BecomeAVenueClient";

export const metadata: Metadata = {
  title: "Become a Founding Venue",
  description:
    "Stand out for your guests on their birthday. Get a branded venue link, your color in the song flow, and attribution on every share for $299/month.",
  alternates: { canonical: "/become-a-venue" },
  robots: { index: true, follow: true },
};

export default function BecomeAVenuePage() {
  return <BecomeAVenueClient />;
}
