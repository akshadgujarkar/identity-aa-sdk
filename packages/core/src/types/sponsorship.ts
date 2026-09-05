/**
 * @identity-aa-sdk/core - Sponsorship Policy Types
 * Specifications from docs/GAS_ABSTRACTION.md and docs/CONFIGURATION.md
 */

import type { HexAddress } from "./account.js";

export type SponsorshipType = "full" | "conditional" | "none";

export interface SponsorshipAllowlist {
  /** Allowed target contract addresses */
  readonly contracts?: readonly HexAddress[];
  /** Allowed 4-byte method selectors or function signatures */
  readonly methods?: readonly string[];
}

export interface RateLimitPolicy {
  /** Maximum number of transactions allowed in the window */
  readonly maxTransactions: number;
  /** Window duration in seconds */
  readonly windowSeconds: number;
}

export interface SpendCapPolicy {
  /** Maximum gas value in wei allowed per period */
  readonly maxGasWei: bigint | string;
  /** Period duration in seconds */
  readonly periodSeconds: number;
}

export interface SponsorshipPolicy {
  /** Type of sponsorship */
  readonly type: SponsorshipType;
  /** Target contract/method allowlists (applicable to "conditional") */
  readonly allowlist?: SponsorshipAllowlist;
  /** Per-user or global rate limiting */
  readonly rateLimit?: RateLimitPolicy;
  /** Gas expenditure limit */
  readonly spendCap?: SpendCapPolicy;
  /** Whether to fall back to unsponsored transaction if sponsorship is denied */
  readonly fallbackToUnsponsored?: boolean;
}

export interface SponsorshipDecision {
  /** Whether gas sponsorship was approved by policy */
  readonly approved: boolean;
  /** Denial or fallback reason if not approved */
  readonly reason?: string;
  /** Whether policy allows falling back to unsponsored execution */
  readonly fallbackToUnsponsored?: boolean;
}

