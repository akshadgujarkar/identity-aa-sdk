/**
 * @identity-aa-sdk/core - Bundler Error Translator
 * Maps raw ERC-4337 AA## codes and JSON-RPC errors to strongly-typed SDK errors per docs/ERROR_MODEL.md
 */

import { SDKError } from "../../errors/base.js";
import {
  BundlerError,
  GasError,
  SponsorshipError,
  SigningError,
  AccountError,
  NetworkError,
  ContractExecutionError,
} from "../../errors/categories.js";

export interface BundlerRpcErrorResponse {
  code?: number;
  message?: string;
  data?: unknown;
}

/**
 * Extracts AA## error code from error strings or data payloads if present.
 */
export function extractAACode(message: string, data?: unknown): string | undefined {
  const match = message.match(/\b(AA\d{2})\b/i);
  if (match) {
    return match[1].toUpperCase();
  }

  if (typeof data === "string") {
    const dataMatch = data.match(/\b(AA\d{2})\b/i);
    if (dataMatch) {
      return dataMatch[1].toUpperCase();
    }
  } else if (data && typeof data === "object") {
    const dataStr = JSON.stringify(data);
    const dataMatch = dataStr.match(/\b(AA\d{2})\b/i);
    if (dataMatch) {
      return dataMatch[1].toUpperCase();
    }
  }

  return undefined;
}

/**
 * Translates raw bundler JSON-RPC error into appropriate SDK error category.
 */
export function translateBundlerError(
  error: unknown,
  context?: Record<string, unknown>
): SDKError {
  if (error instanceof SDKError) {
    return error;
  }

  let rawMessage = "";
  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    rawMessage = (error as any).message;
  } else if (typeof error === "string") {
    rawMessage = error;
  } else {
    rawMessage = JSON.stringify(error) || String(error);
  }
  const cause = error instanceof Error ? error : undefined;

  // 1. Check for Network / Connection Errors
  if (
    /fetch failed|network|econnrefused|etimedout|enotfound|abort/i.test(rawMessage) ||
    (error && typeof error === "object" && "name" in error && error.name === "AbortError")
  ) {
    return new NetworkError({
      code: "BUNDLER_RPC_UNREACHABLE",
      message: `Failed to communicate with Bundler RPC: ${rawMessage}`,
      retryable: true,
      cause,
      debug: context,
    });
  }

  // 2. Extract potential AA## code
  const rpcError = error as BundlerRpcErrorResponse | undefined;
  const aaCode = extractAACode(rawMessage, rpcError?.data);

  if (aaCode) {
    return translateAACode(aaCode, rawMessage, rpcError, cause, context);
  }

  // 3. Check for specific known RPC error patterns
  if (/execution reverted/i.test(rawMessage)) {
    return new ContractExecutionError({
      code: "SIMULATION_OR_EXECUTION_REVERTED",
      message: `Bundler simulation or execution reverted: ${rawMessage}`,
      retryable: false,
      causeCode: rpcError?.code,
      cause,
      debug: { rpcError, ...context },
    });
  }

  if (/gas|fee too low|underpriced/i.test(rawMessage)) {
    return new GasError({
      code: "GAS_ESTIMATION_OR_FEE_ERROR",
      message: `Bundler gas error: ${rawMessage}`,
      retryable: true,
      causeCode: rpcError?.code,
      cause,
      debug: { rpcError, ...context },
    });
  }

  // 4. Default BundlerError mapping
  return new BundlerError({
    code: "BUNDLER_REQUEST_REJECTED",
    message: `Bundler rejected request: ${rawMessage}`,
    retryable: false,
    causeCode: rpcError?.code,
    cause,
    debug: { rpcError, ...context },
  });
}

/**
 * Maps standard ERC-4337 EntryPoint AA## validation and execution errors.
 */
function translateAACode(
  aaCode: string,
  rawMessage: string,
  rpcError?: BundlerRpcErrorResponse,
  cause?: Error,
  context?: Record<string, unknown>
): SDKError {
  switch (aaCode) {
    // AA1x: Account creation & initCode errors
    case "AA10":
    case "AA13":
    case "AA14":
    case "AA15":
      return new AccountError({
        code: `${aaCode}_ACCOUNT_INITIALIZATION_FAILED`,
        message: `Account creation or initialization failed (${aaCode}): ${rawMessage}`,
        causeCode: aaCode,
        cause,
        retryable: false,
        debug: { rpcError, ...context },
      });

    // AA21: Prefund payment error
    case "AA21":
      return new BundlerError({
        code: "AA21_PREFUND_TOO_LOW",
        message: `Account or Paymaster has insufficient deposit/balance to pay UserOperation prefund (${aaCode})`,
        causeCode: aaCode,
        cause,
        retryable: false,
        debug: { rpcError, ...context },
      });

    // AA22: Expired or not due yet
    case "AA22":
      return new BundlerError({
        code: "AA22_EXPIRED_OR_NOT_DUE",
        message: `UserOperation time range is invalid or expired (${aaCode})`,
        causeCode: aaCode,
        cause,
        retryable: true,
        debug: { rpcError, ...context },
      });

    // AA23: Simulation or validation reverted
    case "AA23":
      return new BundlerError({
        code: "AA23_REVERTED_IN_VALIDATION",
        message: `UserOperation reverted during account validation simulation (${aaCode}): ${rawMessage}`,
        causeCode: aaCode,
        cause,
        retryable: false,
        debug: { rpcError, ...context },
      });

    // AA24: Signature error
    case "AA24":
      return new SigningError({
        code: "AA24_INVALID_SIGNATURE",
        message: `UserOperation signature verification failed (${aaCode})`,
        causeCode: aaCode,
        cause,
        retryable: false,
        debug: { rpcError, ...context },
      });

    // AA25: Nonce error
    case "AA25":
      return new BundlerError({
        code: "AA25_INVALID_NONCE",
        message: `UserOperation nonce is invalid or already consumed (${aaCode})`,
        causeCode: aaCode,
        cause,
        retryable: true,
        debug: { rpcError, ...context },
      });

    // AA3x: Paymaster errors
    case "AA31":
      return new SponsorshipError({
        code: "AA31_PAYMASTER_DEPOSIT_TOO_LOW",
        message: `Paymaster deposit is insufficient to sponsor transaction (${aaCode})`,
        causeCode: aaCode,
        cause,
        retryable: false,
        debug: { rpcError, ...context },
      });

    case "AA32":
      return new SponsorshipError({
        code: "AA32_PAYMASTER_EXPIRED",
        message: `Paymaster validity period has expired or is not due (${aaCode})`,
        causeCode: aaCode,
        cause,
        retryable: false,
        debug: { rpcError, ...context },
      });

    case "AA33":
      return new SponsorshipError({
        code: "AA33_PAYMASTER_REVERTED",
        message: `Paymaster validation reverted (${aaCode}): ${rawMessage}`,
        causeCode: aaCode,
        cause,
        retryable: false,
        debug: { rpcError, ...context },
      });

    case "AA34":
      return new SponsorshipError({
        code: "AA34_PAYMASTER_SIGNATURE_ERROR",
        message: `Paymaster signature verification failed (${aaCode})`,
        causeCode: aaCode,
        cause,
        retryable: false,
        debug: { rpcError, ...context },
      });

    // AA9x: Internal / Bundler errors
    case "AA90":
    case "AA91":
    case "AA96":
    default:
      return new BundlerError({
        code: `${aaCode}_BUNDLER_VALIDATION_ERROR`,
        message: `Bundler validation error (${aaCode}): ${rawMessage}`,
        causeCode: aaCode,
        cause,
        retryable: aaCode === "AA90" || aaCode === "AA91",
        debug: { rpcError, ...context },
      });
  }
}
