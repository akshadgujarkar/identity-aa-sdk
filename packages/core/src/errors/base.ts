/**
 * @identity-aa-sdk/core - Base SDK Error
 * Specification from docs/ERROR_MODEL.md
 */

export type ErrorCategory =
  | "IdentityError"
  | "AccountError"
  | "SigningError"
  | "TransactionError"
  | "GasError"
  | "SponsorshipError"
  | "BundlerError"
  | "NetworkError"
  | "ContractExecutionError"
  | "ConfigurationError";

export interface SDKErrorOptions {
  category: ErrorCategory;
  code: string;
  message: string;
  retryable?: boolean;
  debug?: unknown;
  causeCode?: string | number;
  cause?: Error;
}

/**
 * Base error class for all SDK errors.
 * Guarantees that no raw ERC-4337 or JSON-RPC error reaches developer unmapped.
 */
export class SDKError extends Error {
  readonly category: ErrorCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly debug?: unknown;
  readonly causeCode?: string | number;

  constructor(options: SDKErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = options.category;
    this.category = options.category;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.debug = options.debug;
    this.causeCode = options.causeCode;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      category: this.category,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      debug: this.debug,
      causeCode: this.causeCode,
      stack: this.stack,
    };
  }
}
