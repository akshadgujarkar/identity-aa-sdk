/**
 * @identity-aa-sdk/core - Error Categories
 * Concrete error classes specified in docs/ERROR_MODEL.md
 */

import { SDKError, SDKErrorOptions } from "./base.js";

export type CategoryErrorOptions = Omit<SDKErrorOptions, "category">;

/**
 * Thrown when identity resolution fails or session is missing/expired.
 */
export class IdentityError extends SDKError {
  constructor(options: CategoryErrorOptions) {
    super({
      ...options,
      category: "IdentityError",
      retryable: options.retryable ?? false,
    });
  }
}

/**
 * Thrown when account resolution, CREATE2 derivation, or counterfactual check fails.
 */
export class AccountError extends SDKError {
  constructor(options: CategoryErrorOptions) {
    super({
      ...options,
      category: "AccountError",
      retryable: options.retryable ?? false,
    });
  }
}

/**
 * Thrown when local key generation, storage, or cryptographic signing fails.
 */
export class SigningError extends SDKError {
  constructor(options: CategoryErrorOptions) {
    super({
      ...options,
      category: "SigningError",
      retryable: options.retryable ?? false,
    });
  }
}

/**
 * Thrown for general transaction lifecycle failures (timeouts, unexpected state transitions).
 */
export class TransactionError extends SDKError {
  constructor(options: CategoryErrorOptions) {
    super({
      ...options,
      category: "TransactionError",
      retryable: options.retryable ?? true,
    });
  }
}

/**
 * Thrown when gas estimation fails or returns implausible values.
 */
export class GasError extends SDKError {
  constructor(options: CategoryErrorOptions) {
    super({
      ...options,
      category: "GasError",
      retryable: options.retryable ?? true,
    });
  }
}

/**
 * Thrown when sponsorship policy denies sponsorship (rate limit, spend cap, allowlist mismatch).
 */
export class SponsorshipError extends SDKError {
  constructor(options: CategoryErrorOptions) {
    super({
      ...options,
      category: "SponsorshipError",
      retryable: options.retryable ?? false,
    });
  }
}

/**
 * Thrown when bundler RPC is unavailable or rejects the userOperation pre-mempool.
 */
export class BundlerError extends SDKError {
  constructor(options: CategoryErrorOptions) {
    super({
      ...options,
      category: "BundlerError",
      retryable: options.retryable ?? true,
    });
  }
}

/**
 * Thrown when EVM/JSON-RPC network connectivity fails or times out.
 */
export class NetworkError extends SDKError {
  constructor(options: CategoryErrorOptions) {
    super({
      ...options,
      category: "NetworkError",
      retryable: options.retryable ?? true,
    });
  }
}

/**
 * Thrown when transaction was included on-chain but execution reverted.
 */
export class ContractExecutionError extends SDKError {
  constructor(options: CategoryErrorOptions) {
    super({
      ...options,
      category: "ContractExecutionError",
      retryable: options.retryable ?? false,
    });
  }
}

/**
 * Thrown when SDK configuration is invalid, missing required fields, or violates fail-closed rules.
 */
export class ConfigurationError extends SDKError {
  constructor(options: CategoryErrorOptions) {
    super({
      ...options,
      category: "ConfigurationError",
      retryable: options.retryable ?? false,
    });
  }
}
