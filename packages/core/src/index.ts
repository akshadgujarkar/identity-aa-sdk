/**
 * @identity-aa-sdk/core
 * Framework-independent Account Abstraction Core SDK
 */

export * from "./types/index.js";
export * from "./errors/index.js";
export * from "./config/index.js";
export * from "./sdk.js";

// Export internal building blocks for advanced integrations / sibling packages
export { AccountManager } from "./internal/accountManager.js";
export { LocalSigner } from "./internal/signer/signer.js";
export { type KeyStore, InMemoryKeyStore } from "./internal/signer/keystore.js";
export { deriveAccountSalt } from "./internal/salt.js";
export { ChainClient } from "./internal/chain.js";
export { TransactionEngine, TransactionStateMachine, type TransactionLifecycleState } from "./internal/transactionEngine/index.js";
export {
  type PackedUserOperation,
  packAccountGasLimits,
  unpackAccountGasLimits,
  packGasFees,
  unpackGasFees,
  encodeExecuteCalldata,
  encodeExecuteBatchCalldata,
  encodeInitCode,
  getUserOpHash,
} from "./internal/userOp/index.js";
export {
  BundlerClient,
  type BundlerClientOptions,
  type BundlerGasEstimates,
  translateBundlerError,
  extractAACode,
} from "./internal/bundler/index.js";
export { GasPolicyManager } from "./internal/gasPolicy/index.js";
export {
  PaymasterClient,
  type PaymasterClientOptions,
  type UnpackedPaymasterAndData,
  packPaymasterAndData,
  unpackPaymasterAndData,
} from "./internal/paymaster/index.js";



