/**
 * @identity-aa-sdk/react - useTransaction Hook
 * Specifications defined in docs/SDK_ARCHITECTURE.md and docs/phases/PHASE_09_REACT.md.
 */

import { useState, useCallback, useRef } from "react";
import type {
  TransactionIntent,
  Receipt,
  TransactionHandle,
  TransactionState,
  HexData,
} from "@identity-aa-sdk/core";
import { useIdentityAA } from "./context.js";

export interface UseTransactionOptions {
  /** Callback invoked upon successful on-chain transaction confirmation */
  readonly onSuccess?: (receipt: Receipt) => void;
  /** Callback invoked if an error occurs at any lifecycle stage */
  readonly onError?: (error: Error) => void;
  /** Callback invoked as soon as the transaction is submitted to the bundler/network */
  readonly onSubmitted?: (handle: TransactionHandle) => void;
  /** Timeout in milliseconds when awaiting on-chain confirmation (default: 60000) */
  readonly timeoutMs?: number;
}

export interface UseTransactionResult {
  /** Send a single transaction intent and await on-chain receipt */
  readonly send: (intent: TransactionIntent) => Promise<Receipt>;
  /** Send a batch of transaction intents and await on-chain receipt */
  readonly execute: (intents: TransactionIntent[]) => Promise<Receipt>;
  /** Submit a single transaction intent without awaiting confirmation (returns handle) */
  readonly sendAsync: (intent: TransactionIntent) => Promise<TransactionHandle>;
  /** Detailed lifecycle state of the transaction */
  readonly state: TransactionState;
  /** Simplified status enum for UI convenience */
  readonly status: "idle" | "loading" | "success" | "error";
  /** True while a transaction is actively in-flight */
  readonly isLoading: boolean;
  /** True when the latest transaction completed successfully */
  readonly isSuccess: boolean;
  /** True when the latest transaction failed */
  readonly isError: boolean;
  /** Error object if the latest transaction failed */
  readonly error: Error | undefined;
  /** On-chain receipt for the confirmed transaction */
  readonly receipt: Receipt | undefined;
  /** Handle for the active or completed transaction */
  readonly handle: TransactionHandle | undefined;
  /** Transaction hash if submitted or confirmed */
  readonly transactionHash: HexData | undefined;
  /** Reset hook state back to idle */
  readonly reset: () => void;
}

/**
 * Hook to execute sponsored or unsponsored transactions from the user's smart account.
 * Directly mirrors the Transaction Engine's state machine.
 */
export function useTransaction(options: UseTransactionOptions = {}): UseTransactionResult {
  const { account, refetchAccount } = useIdentityAA();
  const [state, setState] = useState<TransactionState>("idle");
  const [error, setError] = useState<Error | undefined>(undefined);
  const [receipt, setReceipt] = useState<Receipt | undefined>(undefined);
  const [handle, setHandle] = useState<TransactionHandle | undefined>(undefined);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const reset = useCallback(() => {
    setState("idle");
    setError(undefined);
    setReceipt(undefined);
    setHandle(undefined);
  }, []);

  const send = useCallback(
    async (intent: TransactionIntent): Promise<Receipt> => {
      if (!account) {
        const err = new Error("Cannot send transaction: No active account resolved in IdentityAAProvider.");
        setError(err);
        setState("failed");
        optionsRef.current.onError?.(err);
        throw err;
      }

      const wasDeployed = account.isDeployed;
      setState("submitting");
      setError(undefined);
      setReceipt(undefined);
      setHandle(undefined);

      try {
        const txHandle = await account.sendTransaction(intent);
        setHandle(txHandle);
        setState("submitted");
        optionsRef.current.onSubmitted?.(txHandle);

        const txReceipt = await txHandle.wait(optionsRef.current.timeoutMs);
        setReceipt(txReceipt);

        if (txReceipt.success) {
          setState("confirmed");
          optionsRef.current.onSuccess?.(txReceipt);
          if (!wasDeployed) {
            void refetchAccount();
          }
          return txReceipt;
        } else {
          setState("failed");
          const failErr = new Error("Transaction execution reverted on-chain.");
          setError(failErr);
          optionsRef.current.onError?.(failErr);
          throw failErr;
        }
      } catch (err: unknown) {
        const normalizedErr = err instanceof Error ? err : new Error(String(err));
        setError(normalizedErr);
        setState("failed");
        optionsRef.current.onError?.(normalizedErr);
        throw normalizedErr;
      }
    },
    [account, refetchAccount]
  );

  const execute = useCallback(
    async (intents: TransactionIntent[]): Promise<Receipt> => {
      if (!account) {
        const err = new Error("Cannot execute batch transaction: No active account resolved in IdentityAAProvider.");
        setError(err);
        setState("failed");
        optionsRef.current.onError?.(err);
        throw err;
      }

      const wasDeployed = account.isDeployed;
      setState("submitting");
      setError(undefined);
      setReceipt(undefined);
      setHandle(undefined);

      try {
        const txHandle = await account.execute(intents);
        setHandle(txHandle);
        setState("submitted");
        optionsRef.current.onSubmitted?.(txHandle);

        const txReceipt = await txHandle.wait(optionsRef.current.timeoutMs);
        setReceipt(txReceipt);

        if (txReceipt.success) {
          setState("confirmed");
          optionsRef.current.onSuccess?.(txReceipt);
          if (!wasDeployed) {
            void refetchAccount();
          }
          return txReceipt;
        } else {
          setState("failed");
          const failErr = new Error("Batch transaction execution reverted on-chain.");
          setError(failErr);
          optionsRef.current.onError?.(failErr);
          throw failErr;
        }
      } catch (err: unknown) {
        const normalizedErr = err instanceof Error ? err : new Error(String(err));
        setError(normalizedErr);
        setState("failed");
        optionsRef.current.onError?.(normalizedErr);
        throw normalizedErr;
      }
    },
    [account, refetchAccount]
  );

  const sendAsync = useCallback(
    async (intent: TransactionIntent): Promise<TransactionHandle> => {
      if (!account) {
        const err = new Error("Cannot send transaction: No active account resolved in IdentityAAProvider.");
        setError(err);
        setState("failed");
        optionsRef.current.onError?.(err);
        throw err;
      }

      setState("submitting");
      setError(undefined);
      setReceipt(undefined);
      setHandle(undefined);

      try {
        const txHandle = await account.sendTransaction(intent);
        setHandle(txHandle);
        setState("submitted");
        optionsRef.current.onSubmitted?.(txHandle);
        return txHandle;
      } catch (err: unknown) {
        const normalizedErr = err instanceof Error ? err : new Error(String(err));
        setError(normalizedErr);
        setState("failed");
        optionsRef.current.onError?.(normalizedErr);
        throw normalizedErr;
      }
    },
    [account]
  );

  const isLoading = state !== "idle" && state !== "confirmed" && state !== "failed";
  const isSuccess = state === "confirmed";
  const isError = state === "failed";

  const status: "idle" | "loading" | "success" | "error" =
    isSuccess ? "success" : isError ? "error" : isLoading ? "loading" : "idle";

  return {
    send,
    execute,
    sendAsync,
    state,
    status,
    isLoading,
    isSuccess,
    isError,
    error,
    receipt,
    handle,
    transactionHash: handle?.transactionHash ?? receipt?.transactionHash,
    reset,
  };
}
