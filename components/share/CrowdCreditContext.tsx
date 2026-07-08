"use client";

// Carries the crowd-song contributor credit from the server share page into the
// (client) share template, without prop-drilling through all five templates.
// Contributions live in Postgres, so they can only be fetched server-side (in
// app/share/[id]/page.tsx); this makes the resulting count + names ambient for
// the template subtree. Non-crowd shares simply never wrap with a provider, so
// the value stays null and the template renders exactly as before.

import { createContext, useContext } from "react";

export type CrowdCredit = {
  /** Total approved contributions (may exceed the named list — some anonymous). */
  count: number;
  /** Display names of contributors who gave one (nulls already filtered out). */
  contributors: string[];
};

const CrowdCreditContext = createContext<CrowdCredit | null>(null);

export function CrowdCreditProvider({
  value,
  children,
}: {
  value: CrowdCredit;
  children: React.ReactNode;
}) {
  return (
    <CrowdCreditContext.Provider value={value}>
      {children}
    </CrowdCreditContext.Provider>
  );
}

/** Returns the crowd credit for the current share, or null for non-crowd shares. */
export function useCrowdCredit(): CrowdCredit | null {
  return useContext(CrowdCreditContext);
}
