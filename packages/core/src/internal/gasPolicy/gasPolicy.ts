/**
 * @identity-aa-sdk/core - Gas Policy Manager
 * Evaluates sponsorship policies, allowlists, rate limits, and spend caps per docs/GAS_ABSTRACTION.md
 */

import type { TransactionIntent } from "../../types/transaction.js";
import type { SponsorshipPolicy, SponsorshipDecision } from "../../types/sponsorship.js";
import type { Environment } from "../../config/schema.js";
import { SponsorshipError } from "../../errors/categories.js";

export interface RateLimitEntry {
  timestamps: number[];
}

export interface SpendCapEntry {
  periodStart: number;
  spentWei: bigint;
}

export class GasPolicyManager {
  private policy?: SponsorshipPolicy;
  private readonly environment: Environment;
  private readonly rateLimits = new Map<string, RateLimitEntry>();
  private readonly spendCaps = new Map<string, SpendCapEntry>();

  constructor(policy?: SponsorshipPolicy, environment: Environment = "development") {
    this.policy = policy;
    this.environment = environment;
  }

  public setPolicy(policy?: SponsorshipPolicy): void {
    this.policy = policy;
  }

  public getPolicy(): SponsorshipPolicy | undefined {
    return this.policy;
  }

  /**
   * Evaluates if a batch of transaction intents is eligible for gas sponsorship.
   */
  public evaluateSponsorship(
    intents: readonly TransactionIntent[],
    subjectKey = "global",
    estimatedGasCostWei = 0n
  ): SponsorshipDecision {
    // 1. Production Fail-Closed Rule
    if (this.environment === "production" && !this.policy) {
      throw new SponsorshipError({
        code: "MISSING_PRODUCTION_SPONSORSHIP_POLICY",
        message: "Production environment requires explicit sponsorship policy configuration (fail-closed)",
        retryable: false,
      });
    }

    if (!this.policy || this.policy.type === "none") {
      return {
        approved: false,
        reason: "Sponsorship policy is disabled or set to none",
        fallbackToUnsponsored: this.policy?.fallbackToUnsponsored ?? true,
      };
    }

    // 2. Allowlist checks for conditional policy
    if (this.policy.type === "conditional") {
      const allowlist = this.policy.allowlist;
      if (allowlist) {
        for (let i = 0; i < intents.length; i++) {
          const intent = intents[i];

          // Contract address allowlist check
          if (allowlist.contracts && allowlist.contracts.length > 0) {
            const isContractAllowed = allowlist.contracts.some(
              (addr) => addr.toLowerCase() === intent.to.toLowerCase()
            );
            if (!isContractAllowed) {
              return this._handleDenial(
                "TARGET_NOT_ALLOWLISTED",
                `Target contract address ${intent.to} at index ${i} is not in the sponsorship allowlist`,
                { intent, index: i }
              );
            }
          }

          // Method selector check
          if (allowlist.methods && allowlist.methods.length > 0) {
            const data = intent.data || "0x";
            const selector = data.length >= 10 ? data.slice(0, 10).toLowerCase() : "";
            const isMethodAllowed = allowlist.methods.some((m) => {
              const formatted = m.startsWith("0x") ? m.toLowerCase() : m;
              return formatted === selector || formatted === data.toLowerCase();
            });

            if (!isMethodAllowed) {
              return this._handleDenial(
                "METHOD_NOT_ALLOWLISTED",
                `Method selector ${selector || "empty"} at index ${i} is not in the sponsorship allowlist`,
                { intent, index: i, selector }
              );
            }
          }
        }
      }
    }

    const now = Date.now();

    // 3. Rate limit check
    if (this.policy.rateLimit) {
      const { maxTransactions, windowSeconds } = this.policy.rateLimit;
      const windowMs = windowSeconds * 1000;
      let entry = this.rateLimits.get(subjectKey);
      if (!entry) {
        entry = { timestamps: [] };
        this.rateLimits.set(subjectKey, entry);
      }

      // Filter out timestamps outside current window
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

      if (entry.timestamps.length >= maxTransactions) {
        return this._handleDenial(
          "RATE_LIMIT_EXCEEDED",
          `Rate limit of ${maxTransactions} transactions per ${windowSeconds}s exceeded for ${subjectKey}`,
          { subjectKey, maxTransactions, windowSeconds, currentCount: entry.timestamps.length }
        );
      }
    }

    // 4. Spend cap check
    if (this.policy.spendCap) {
      const { maxGasWei, periodSeconds } = this.policy.spendCap;
      const capWei = typeof maxGasWei === "bigint" ? maxGasWei : BigInt(maxGasWei);
      const periodMs = periodSeconds * 1000;
      let entry = this.spendCaps.get(subjectKey);

      if (!entry || now - entry.periodStart >= periodMs) {
        entry = { periodStart: now, spentWei: 0n };
        this.spendCaps.set(subjectKey, entry);
      }

      if (entry.spentWei + estimatedGasCostWei > capWei) {
        return this._handleDenial(
          "SPEND_CAP_EXCEEDED",
          `Spend cap of ${capWei.toString()} wei per ${periodSeconds}s exceeded for ${subjectKey}`,
          { subjectKey, capWei: capWei.toString(), currentSpent: entry.spentWei.toString(), estimatedCost: estimatedGasCostWei.toString() }
        );
      }
    }

    // Record usage
    this._recordUsage(subjectKey, now, estimatedGasCostWei);

    return {
      approved: true,
    };
  }

  private _recordUsage(subjectKey: string, now: number, gasCostWei: bigint): void {
    if (this.policy?.rateLimit) {
      const entry = this.rateLimits.get(subjectKey);
      if (entry) {
        entry.timestamps.push(now);
      }
    }

    if (this.policy?.spendCap) {
      const entry = this.spendCaps.get(subjectKey);
      if (entry) {
        entry.spentWei += gasCostWei;
      }
    }
  }

  private _handleDenial(
    code: string,
    message: string,
    debug?: Record<string, unknown>
  ): SponsorshipDecision {
    if (this.policy?.fallbackToUnsponsored) {
      return {
        approved: false,
        reason: message,
        fallbackToUnsponsored: true,
      };
    }

    throw new SponsorshipError({
      code,
      message,
      retryable: false,
      debug,
    });
  }

  /**
   * Resets recorded rate limits and spend caps (useful for testing).
   */
  public reset(): void {
    this.rateLimits.clear();
    this.spendCaps.clear();
  }
}
