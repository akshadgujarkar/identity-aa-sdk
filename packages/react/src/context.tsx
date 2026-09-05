/**
 * @identity-aa-sdk/react - Context & Hook Accessor
 * Specifications defined in docs/SDK_ARCHITECTURE.md and docs/phases/PHASE_09_REACT.md.
 */

import React, { createContext, useContext } from "react";
import type { IdentityAASDK, Account } from "@identity-aa-sdk/core";

export interface IdentityAAContextValue {
  /** The underlying IdentityAASDK client instance */
  readonly client: IdentityAASDK;
  /** The current resolved account, if available */
  readonly account: Account | undefined;
  /** True while the account is being derived / resolved */
  readonly isLoadingAccount: boolean;
  /** Error encountered during account resolution, if any */
  readonly accountError: Error | undefined;
  /** Manually trigger re-resolution of the account */
  readonly refetchAccount: () => Promise<Account | undefined>;
}

export const IdentityAAContext = createContext<IdentityAAContextValue | null>(null);

/**
 * Hook to access the Identity AA SDK context.
 * Throws an error if called outside an <IdentityAAProvider>.
 */
export function useIdentityAA(): IdentityAAContextValue {
  const context = useContext(IdentityAAContext);
  if (!context) {
    throw new Error(
      "useIdentityAA must be used within an <IdentityAAProvider>. " +
        "Ensure you have wrapped your component tree in <IdentityAAProvider>."
    );
  }
  return context;
}
