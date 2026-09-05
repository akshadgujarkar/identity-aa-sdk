/**
 * @identity-aa-sdk/core - Transaction Lifecycle State Machine
 * Specification from docs/TRANSACTION_ENGINE.md
 */

import { SDKError } from "../../errors/base.js";
import { TransactionError } from "../../errors/categories.js";
import type { Receipt, TransactionHandle } from "../../types/transaction.js";
import type { HexData } from "../../types/account.js";

export type TransactionLifecycleState =
  | "Building"
  | "Estimating"
  | "Signing"
  | "Submitting"
  | "Pending"
  | "Confirmed"
  | "Failed"
  | "Dropped";

const ALLOWED_TRANSITIONS: Record<TransactionLifecycleState, readonly TransactionLifecycleState[]> = {
  Building: ["Estimating", "Failed"],
  Estimating: ["Signing", "Failed"],
  Signing: ["Submitting", "Failed"],
  Submitting: ["Pending", "Failed"],
  Pending: ["Confirmed", "Failed", "Dropped"],
  Confirmed: [],
  Failed: [],
  Dropped: [],
};

export type StateListener = (state: TransactionLifecycleState, error?: SDKError) => void;

export class TransactionStateMachine implements TransactionHandle {
  private _state: TransactionLifecycleState = "Building";
  private _userOpHash: HexData;
  private _error?: SDKError;
  private _receipt?: Receipt;
  private readonly _listeners = new Set<StateListener>();

  private _resolveWait!: (receipt: Receipt) => void;
  private _rejectWait!: (error: SDKError) => void;
  private readonly _waitPromise: Promise<Receipt>;

  constructor(initialHash: HexData = "0x") {
    this._userOpHash = initialHash;
    this._waitPromise = new Promise<Receipt>((resolve, reject) => {
      this._resolveWait = resolve;
      this._rejectWait = reject;
    });
    // Attach noop error handler to internal promise to prevent unhandled rejection events
    // when callers do not immediately await wait().
    this._waitPromise.catch(() => {});
  }

  get state(): TransactionLifecycleState {
    return this._state;
  }

  get userOpHash(): HexData {
    return this._userOpHash;
  }

  get transactionHash(): HexData {
    return this._receipt?.transactionHash || this._userOpHash;
  }

  get error(): SDKError | undefined {
    return this._error;
  }

  get receipt(): Receipt | undefined {
    return this._receipt;
  }

  public setUserOpHash(hash: HexData): void {
    this._userOpHash = hash;
  }

  public onStateChange(listener: StateListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  public transitionTo(nextState: TransactionLifecycleState, error?: SDKError): void {
    if (this._state === nextState) {
      return;
    }

    const allowed = ALLOWED_TRANSITIONS[this._state];
    if (!allowed.includes(nextState)) {
      const transitionErr = new TransactionError({
        code: "INVALID_STATE_TRANSITION",
        message: `Invalid state transition from ${this._state} to ${nextState}`,
        debug: { currentState: this._state, nextState },
        retryable: false,
      });
      this._error = transitionErr;
      this._state = "Failed";
      this._notify();
      this._rejectWait(transitionErr);
      throw transitionErr;
    }

    this._state = nextState;
    if (error) {
      this._error = error;
    }

    this._notify();

    if (nextState === "Failed") {
      const err = this._error ?? new TransactionError({
        code: "TRANSACTION_FAILED",
        message: "Transaction failed with an unknown error",
        debug: { userOpHash: this._userOpHash },
      });
      this._rejectWait(err);
    } else if (nextState === "Dropped") {
      const dropErr = this._error ?? new TransactionError({
        code: "TRANSACTION_DROPPED",
        message: "Transaction was dropped from mempool or timed out",
        debug: { userOpHash: this._userOpHash },
        retryable: true,
      });
      this._rejectWait(dropErr);
    }
  }

  public confirm(receipt: Receipt): void {
    this._receipt = receipt;
    if (receipt.success) {
      this.transitionTo("Confirmed");
      this._resolveWait(receipt);
    } else {
      const execError = new TransactionError({
        code: "EXECUTION_REVERTED",
        message: "Transaction reverted on-chain during execution",
        debug: { receipt },
        retryable: false,
      });
      this.transitionTo("Failed", execError);
    }
  }

  public fail(error: SDKError): void {
    this.transitionTo("Failed", error);
  }

  public drop(reason: string): void {
    const dropError = new TransactionError({
      code: "TRANSACTION_DROPPED",
      message: `Transaction dropped: ${reason}`,
      debug: { reason, userOpHash: this._userOpHash },
      retryable: true,
    });
    this.transitionTo("Dropped", dropError);
  }

  public async wait(timeoutMs?: number): Promise<Receipt> {
    if (this._receipt && this._state === "Confirmed") {
      return this._receipt;
    }
    if (this._error && (this._state === "Failed" || this._state === "Dropped")) {
      throw this._error;
    }

    if (!timeoutMs || timeoutMs <= 0) {
      return this._waitPromise;
    }

    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const timeoutErr = new TransactionError({
          code: "TRANSACTION_TIMEOUT",
          message: `Transaction timed out after ${timeoutMs}ms in state ${this._state}`,
          debug: { userOpHash: this._userOpHash, state: this._state, timeoutMs },
          retryable: true,
        });
        if (this._state === "Pending") {
          this.transitionTo("Dropped", timeoutErr);
        }
        reject(timeoutErr);
      }, timeoutMs);
    });

    try {
      const res = await Promise.race([this._waitPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      return res;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      try {
        listener(this._state, this._error);
      } catch {
        // Suppress listener errors to maintain state machine integrity
      }
    }
  }
}
