import { launchView } from "@/lib/launch-pricing";

/**
 * Renders a price label, honoring the launch discount. When a launch is active
 * it shows the original price struck through followed by the discounted price;
 * otherwise it renders the plain label. Pure/presentational — the discount state
 * comes from the build-time NEXT_PUBLIC_LAUNCH_DISCOUNT_PERCENT via launchView.
 */
export default function PriceLabel({
  label,
  className,
  strikeClassName,
}: {
  label: string;
  className?: string;
  strikeClassName?: string;
}) {
  const v = launchView(label);
  if (!v.active) return <span className={className}>{label}</span>;
  return (
    <span className={className}>
      <span className={strikeClassName ?? "mr-1 font-semibold text-ink-soft line-through opacity-60"}>
        {v.original}
      </span>
      {v.discounted}
    </span>
  );
}
