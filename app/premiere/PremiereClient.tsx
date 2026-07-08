"use client";

// Thin client wrapper so the server page can pass data while we attach a
// client-side onContinue handler (functions can't cross the server boundary).

import PremiereReveal, {
  type PremiereRevealProps,
} from "@/components/premiere/PremiereReveal";

export default function PremiereClient(
  props: Omit<PremiereRevealProps, "onContinue">,
) {
  return (
    <PremiereReveal
      {...props}
      continueLabel="Отправить им 💌"
      onContinue={() => {
        // Preview-only: in the real flow this advances to the share/send step.
        alert(
          `В реальном flow здесь откроется отправка песни для ${props.recipientName}.`,
        );
      }}
    />
  );
}
