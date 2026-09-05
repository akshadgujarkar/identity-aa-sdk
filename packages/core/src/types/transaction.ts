/**
 * @identity-aa-sdk/core - Transaction Types
 * Specifications from docs/API_DESIGN.md and docs/TRANSACTION_ENGINE.md
 */

import type { HexAddress, HexData } from "./account.js";

/**
 * TransactionIntent represents an intent to perform an on-chain action.
 */
export interface TransactionIntent {
  /** Target contract or recipient address */
  readonly to: HexAddress;
  /** Amount of native token (wei) to send */
  readonly value?: bigint | string;
  /** Calldata for the contract call */
  readonly data?: HexData | string;
}

/**
 * Receipt represents the on-chain confirmation of an executed transaction.
 */
export interface Receipt {
  /** The transaction hash on the blockchain */
  readonly transactionHash: HexData;
  /** Block number in which the transaction was included */
  readonly blockNumber: bigint | number;
  /** Block hash if available */
  readonly blockHash?: HexData;
  /** Whether the transaction succeeded */
  readonly success: boolean;
  /** Total gas consumed */
  readonly gasUsed?: bigint | string;
  /** Emitted event logs */
  readonly logs?: readonly unknown[];
}

/**
 * TransactionHandle allows awaiting on-chain inclusion.
 */
export interface TransactionHandle {
  /** The transaction or userOperation submission identifier */
  readonly transactionHash: HexData;
  /** Wait for the transaction to be mined and return the receipt */
  wait(timeoutMs?: number): Promise<Receipt>;
}

/**
 * High-level lifecycle states of an SDK transaction.
 */
export type TransactionState =
  | "idle"
  | "building"
  | "estimating"
  | "signing"
  | "sponsoring"
  | "submitting"
  | "submitted"
  | "confirmed"
  | "failed";
