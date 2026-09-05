/**
 * @identity-aa-sdk/react - useSmartAccount Hook
 * Specifications defined in docs/SDK_ARCHITECTURE.md and docs/phases/PHASE_09_REACT.md.
 */

import type { Account, HexAddress } from "@identity-aa-sdk/core";
import { useIdentityAA } from "./context.js";

export interface UseSmartAccountResult {
  /** The resolved Smart Account instance, or undefined while loading / unresolved */
  readonly account: Account | undefined;
  /** Counterfactual or deployed on-chain address of the smart account */
  readonly address: HexAddress | undefined;
  /** True if the smart account contract has been deployed on-chain */
  readonly isDeployed: boolean;
  /** Chain ID of the target network */
  readonly chainId: number | undefined;
  /** True while resolving identity and deriving/verifying account */
  readonly isLoading: boolean;
  /** Resolution error, if any occurred */
  readonly error: Error | undefined;
  /** Manually trigger re-resolution or refresh deployment status */
  readonly refetch: () => Promise<Account | undefined>;
}

/**
 * Hook to access the authenticated smart account state, address, and deployment status.
 * Values are sourced from the nearest <IdentityAAProvider>.
 */
export function useSmartAccount(): UseSmartAccountResult {
  const { account, isLoadingAccount, accountError, refetchAccount } = useIdentityAA();

  return {
    account,
    address: account?.address,
    isDeployed: account?.isDeployed ?? false,
    chainId: account?.chainId,
    isLoading: isLoadingAccount,
    error: accountError,
    refetch: refetchAccount,
  };
}
