/**
 * @identity-aa-sdk/core - Bundler Client
 * ERC-4337 Bundler JSON-RPC client wrapper and receipt polling engine
 */

import type { PackedUserOperation } from "../userOp/types.js";
import type { HexAddress, HexData } from "../../types/account.js";
import type { Receipt } from "../../types/transaction.js";
import { translateBundlerError } from "./errorTranslator.js";
import { TransactionError } from "../../errors/categories.js";

export interface BundlerGasEstimates {
  preVerificationGas: bigint;
  verificationGasLimit: bigint;
  callGasLimit: bigint;
  paymasterVerificationGasLimit?: bigint;
}

export interface BundlerClientOptions {
  bundlerUrl: string;
  entryPointAddress?: HexAddress;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface UserOpJsonRpcWire {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  accountGasLimits: string;
  preVerificationGas: string;
  gasFees: string;
  paymasterAndData: string;
  signature: string;
}

export interface BundlerReceiptRpcResponse {
  userOpHash: string;
  entryPoint: string;
  sender: string;
  nonce: string;
  paymaster?: string;
  actualGasCost: string;
  actualGasUsed: string;
  success: boolean | string;
  reason?: string;
  logs: unknown[];
  receipt: {
    transactionHash: string;
    blockNumber: string;
    blockHash: string;
    gasUsed: string;
    from: string;
    to?: string;
    status: string | number;
    logs: unknown[];
  };
}

/**
 * Converts a PackedUserOperation struct to JSON-RPC wire hex format.
 */
export function serializeUserOpToRpc(userOp: PackedUserOperation): UserOpJsonRpcWire {
  return {
    sender: userOp.sender,
    nonce: `0x${userOp.nonce.toString(16)}`,
    initCode: userOp.initCode || "0x",
    callData: userOp.callData || "0x",
    accountGasLimits: userOp.accountGasLimits,
    preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
    gasFees: userOp.gasFees,
    paymasterAndData: userOp.paymasterAndData || "0x",
    signature: userOp.signature || "0x",
  };
}

/**
 * Parses hex strings into bigint safely.
 */
function parseHexBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") {
    if (value.startsWith("0x") || value.startsWith("0X")) {
      return BigInt(value);
    }
    return BigInt(`0x${value}`);
  }
  return 0n;
}

export class BundlerClient {
  public readonly bundlerUrl: string;
  public readonly requestTimeoutMs: number;
  public readonly pollIntervalMs: number;
  public readonly pollTimeoutMs: number;
  private readonly customFetch?: typeof fetch;
  private idCounter = 1;

  constructor(options: BundlerClientOptions) {
    this.bundlerUrl = options.bundlerUrl;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 1_500;
    this.pollTimeoutMs = options.pollTimeoutMs ?? 60_000;
    this.customFetch = options.fetchFn;
  }

  private async fetchWrapper(url: string, init: RequestInit): Promise<Response> {
    if (this.customFetch) {
      return this.customFetch(url, init);
    }
    if (typeof window !== "undefined" && typeof window.fetch === "function") {
      return window.fetch(url, init);
    }
    return globalThis.fetch(url, init);
  }

  /**
   * Executes a raw JSON-RPC call against the Bundler endpoint.
   */
  public async callRpc<T = unknown>(
    method: string,
    params: unknown[],
    retries = 1
  ): Promise<T> {
    const id = this.idCounter++;
    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const res = await this.fetchWrapper(this.bundlerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = (await res.json()) as {
          jsonrpc: string;
          id: number;
          result?: T;
          error?: { code: number; message: string; data?: unknown };
        };

        if (data.error) {
          throw translateBundlerError(data.error, { method, params });
        }

        return data.result as T;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = translateBundlerError(err, { method, params, attempt });
        if (attempt < retries && (lastError as any).retryable) {
          // Linear backoff for network/transient errors
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }
    }

    throw lastError;
  }

  /**
   * Estimates gas limits for a UserOperation via eth_estimateUserOperationGas.
   */
  public async estimateUserOperationGas(
    userOp: PackedUserOperation,
    entryPointAddress: HexAddress
  ): Promise<BundlerGasEstimates> {
    const wireOp = serializeUserOpToRpc(userOp);
    const result = await this.callRpc<{
      preVerificationGas: string | number;
      verificationGasLimit: string | number;
      callGasLimit: string | number;
      paymasterVerificationGasLimit?: string | number;
    }>("eth_estimateUserOperationGas", [wireOp, entryPointAddress]);

    return {
      preVerificationGas: parseHexBigInt(result.preVerificationGas),
      verificationGasLimit: parseHexBigInt(result.verificationGasLimit),
      callGasLimit: parseHexBigInt(result.callGasLimit),
      paymasterVerificationGasLimit:
        result.paymasterVerificationGasLimit !== undefined
          ? parseHexBigInt(result.paymasterVerificationGasLimit)
          : undefined,
    };
  }

  /**
   * Submits a signed UserOperation to the bundler mempool via eth_sendUserOperation.
   */
  public async sendUserOperation(
    userOp: PackedUserOperation,
    entryPointAddress: HexAddress
  ): Promise<HexData> {
    const wireOp = serializeUserOpToRpc(userOp);
    const userOpHash = await this.callRpc<HexData>("eth_sendUserOperation", [
      wireOp,
      entryPointAddress,
    ]);

    if (!userOpHash || typeof userOpHash !== "string" || !userOpHash.startsWith("0x")) {
      throw translateBundlerError(
        new Error(`Bundler returned invalid userOpHash: ${JSON.stringify(userOpHash)}`),
        { userOp }
      );
    }

    return userOpHash as HexData;
  }

  /**
   * Fetches the on-chain receipt for a given userOpHash if available.
   */
  public async getUserOperationReceipt(userOpHash: HexData): Promise<Receipt | null> {
    const rawReceipt = await this.callRpc<BundlerReceiptRpcResponse | null>(
      "eth_getUserOperationReceipt",
      [userOpHash]
    );

    if (!rawReceipt) {
      return null;
    }

    const isSuccess =
      rawReceipt.success === true ||
      rawReceipt.success === "0x1" ||
      rawReceipt.success === "1" ||
      rawReceipt.receipt?.status === "0x1" ||
      rawReceipt.receipt?.status === 1;

    const txHash =
      (rawReceipt.receipt?.transactionHash as HexData) ||
      (rawReceipt.userOpHash as HexData) ||
      userOpHash;

    const blockNum = rawReceipt.receipt?.blockNumber
      ? parseHexBigInt(rawReceipt.receipt.blockNumber)
      : 0n;

    const gasUsed = rawReceipt.actualGasUsed
      ? parseHexBigInt(rawReceipt.actualGasUsed)
      : rawReceipt.receipt?.gasUsed
      ? parseHexBigInt(rawReceipt.receipt.gasUsed)
      : undefined;

    return {
      transactionHash: txHash,
      blockNumber: blockNum,
      success: isSuccess,
      gasUsed,
      logs: rawReceipt.logs || rawReceipt.receipt?.logs,
    };
  }

  /**
   * Polls the Bundler until the UserOperation receipt is confirmed or dropped/timed out.
   */
  public async pollUserOperationReceipt(
    userOpHash: HexData,
    options?: {
      pollIntervalMs?: number;
      timeoutMs?: number;
      onPoll?: (attempt: number) => void;
    }
  ): Promise<Receipt> {
    const interval = options?.pollIntervalMs ?? this.pollIntervalMs;
    const timeout = options?.timeoutMs ?? this.pollTimeoutMs;
    const startTime = Date.now();
    let attempt = 0;

    while (Date.now() - startTime < timeout) {
      attempt++;
      options?.onPoll?.(attempt);

      try {
        const receipt = await this.getUserOperationReceipt(userOpHash);
        if (receipt) {
          return receipt;
        }
      } catch (err) {
        // If an RPC error occurs during poll, check if it's transient
        const translated = translateBundlerError(err, { userOpHash, attempt });
        if (!translated.retryable) {
          throw translated;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new TransactionError({
      code: "RECEIPT_POLL_TIMEOUT",
      message: `Transaction confirmation timed out after ${timeout}ms waiting for receipt for userOpHash: ${userOpHash}`,
      debug: { userOpHash, timeoutMs: timeout, attempts: attempt },
      retryable: true,
    });
  }

  /**
   * Queries supported EntryPoints from the bundler.
   */
  public async getSupportedEntryPoints(): Promise<HexAddress[]> {
    return this.callRpc<HexAddress[]>("eth_supportedEntryPoints", []);
  }
}
