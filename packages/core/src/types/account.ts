/**
 * @identity-aa-sdk/core - Account Types
 * Specifications from docs/API_DESIGN.md, docs/SMART_ACCOUNT.md, and docs/KEY_MANAGEMENT.md
 */

import type { TransactionIntent, TransactionHandle } from "./transaction.js";

export type HexAddress = `0x${string}`;
export type HexData = `0x${string}`;

/**
 * Signer represents a client-held non-extractable key for authorizing operations.
 */
export interface Signer {
  /** Identifier or fingerprint of the key */
  readonly keyId: string;
  /** The public Ethereum address corresponding to this signer */
  getAddress(): Promise<HexAddress>;
  /** Sign an arbitrary message (off-chain signature) */
  signMessage(message: Uint8Array | string): Promise<HexData>;
  /** Sign a 32-byte digest / hash (e.g. userOpHash) */
  signHash(hash: HexData | Uint8Array): Promise<HexData>;
}

/**
 * Account represents the resolved Smart Account instance.
 */
export interface Account {
  /** The smart account contract address on-chain */
  readonly address: HexAddress;
  /** Whether the smart account has been deployed on-chain */
  readonly isDeployed: boolean;
  /** The target chain ID */
  readonly chainId: number;

  /** Execute a single on-chain transaction */
  sendTransaction(intent: TransactionIntent): Promise<TransactionHandle>;
  /** Execute a batch of on-chain transactions */
  execute(intents: TransactionIntent[]): Promise<TransactionHandle>;
  /** Produce an off-chain signature attributable to the smart account */
  signMessage(message: Uint8Array | string): Promise<HexData>;
}
