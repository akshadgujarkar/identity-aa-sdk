/**
 * @identity-aa-sdk/core - Configuration Schema
 * Specifications from docs/CONFIGURATION.md and docs/GAS_ABSTRACTION.md
 */

import type { HexAddress } from "../types/account.js";
import type { SponsorshipPolicy } from "../types/sponsorship.js";

export type Environment = "development" | "production" | "test";

export interface NetworkConfig {
  /** EVM Chain ID (e.g., 31337 for local anvil, 11155111 for Sepolia) */
  readonly chainId: number;
  /** JSON-RPC endpoint for chain state */
  readonly rpcUrl: string;
  /** ERC-4337 Bundler JSON-RPC endpoint */
  readonly bundlerUrl?: string;
  /** Canonical ERC-4337 EntryPoint contract address */
  readonly entryPointAddress: HexAddress;
  /** Deployed Account Factory contract address */
  readonly factoryAddress?: HexAddress;
  /** Deployed Paymaster contract address */
  readonly paymasterAddress?: HexAddress;
}

export interface SDKConfig {
  /** Runtime environment. Defaults to "development". */
  readonly environment?: Environment;
  /** Network configuration */
  readonly network: NetworkConfig;
  /** Gas sponsorship policy configuration */
  readonly sponsorship?: SponsorshipPolicy;
  /** Clerk Frontend Publishable Key */
  readonly clerkPublishableKey?: string;
  /** Explicit forbidden field in frontend config - checked by validator to prevent leaks */
  readonly clerkSecretKey?: never;
}

export const DEFAULT_LOCAL_NETWORK: NetworkConfig = {
  chainId: 31337,
  rpcUrl: "http://127.0.0.1:8545",
  bundlerUrl: "http://127.0.0.1:4337",
  entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
};
