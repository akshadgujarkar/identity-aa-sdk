/**
 * @identity-aa-sdk/react
 * React bindings and hooks for Identity AA SDK.
 * Specifications defined in docs/SDK_ARCHITECTURE.md and docs/phases/PHASE_09_REACT.md.
 */

// Provider and context exports
export {
  IdentityAAProvider,
  type IdentityAAProviderProps,
} from "./Provider.js";

export {
  IdentityAAContext,
  useIdentityAA,
  type IdentityAAContextValue,
} from "./context.js";

// Hook exports
export {
  useSmartAccount,
  type UseSmartAccountResult,
} from "./useSmartAccount.js";

export {
  useTransaction,
  type UseTransactionResult,
  type UseTransactionOptions,
} from "./useTransaction.js";

// Re-export key core types for consumer convenience
export type {
  Account,
  TransactionIntent,
  Receipt,
  TransactionHandle,
  TransactionState,
  SDKConfig,
  IdentityResolver,
  AppIdentity,
  HexAddress,
  HexData,
  SponsorshipPolicy,
  IdentityAASDK,
} from "@identity-aa-sdk/core";
