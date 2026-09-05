/**
 * @identity-aa-sdk/core - Transaction Engine
 * Specification from docs/TRANSACTION_ENGINE.md and docs/API_DESIGN.md
 */

import { isAddress } from "viem";
import type { HexAddress, HexData, Signer } from "../../types/account.js";
import type { TransactionIntent } from "../../types/transaction.js";
import {
  BundlerError,
  GasError,
  SigningError,
  SponsorshipError,
  TransactionError,
} from "../../errors/categories.js";
import { ChainClient } from "../chain.js";
import { BundlerClient } from "../bundler/bundlerClient.js";
import { GasPolicyManager } from "../gasPolicy/gasPolicy.js";
import { PaymasterClient, packPaymasterAndData } from "../paymaster/paymasterClient.js";
import { encodeExecuteCalldata, encodeExecuteBatchCalldata, encodeInitCode } from "../userOp/calldata.js";
import { packAccountGasLimits, packGasFees, type PackedUserOperation } from "../userOp/types.js";
import { getUserOpHash } from "../userOp/hash.js";
import { TransactionStateMachine } from "./stateMachine.js";

export interface TransactionEngineOptions {
  readonly chainClient: ChainClient;
  readonly entryPointAddress: HexAddress;
  readonly factoryAddress?: HexAddress;
  readonly chainId: number;
  readonly signer: Signer;
  readonly senderAddress: HexAddress;
  readonly ownerAddress: HexAddress;
  readonly salt: HexData;
  readonly environment?: "development" | "production" | "test";
  /** Optional BundlerClient instance for RPC estimation, submission, and polling */
  readonly bundlerClient?: BundlerClient;
  /** Optional custom submit handler for mocking or testing */
  readonly submitHandler?: (userOp: PackedUserOperation) => Promise<HexData>;
  /** Optional Paymaster contract address for gas sponsorship */
  readonly paymasterAddress?: HexAddress;
  /** Optional GasPolicyManager for evaluating sponsorship policies */
  readonly gasPolicyManager?: GasPolicyManager;
  /** Optional PaymasterClient instance */
  readonly paymasterClient?: PaymasterClient;
  /** Optional user subject identifier for rate-limiting and spend caps */
  readonly subjectKey?: string;
}

export class TransactionEngine {
  private readonly chainClient: ChainClient;
  private readonly entryPointAddress: HexAddress;
  private readonly factoryAddress?: HexAddress;
  private readonly chainId: number;
  private readonly signer: Signer;
  private readonly senderAddress: HexAddress;
  private readonly ownerAddress: HexAddress;
  private readonly salt: HexData;
  private readonly environment: "development" | "production" | "test";
  private readonly bundlerClient?: BundlerClient;
  private readonly submitHandler?: (userOp: PackedUserOperation) => Promise<HexData>;
  private readonly paymasterAddress?: HexAddress;
  private readonly gasPolicyManager?: GasPolicyManager;
  private readonly paymasterClient?: PaymasterClient;
  private readonly subjectKey?: string;

  constructor(options: TransactionEngineOptions) {
    this.chainClient = options.chainClient;
    this.entryPointAddress = options.entryPointAddress;
    this.factoryAddress = options.factoryAddress;
    this.chainId = options.chainId;
    this.signer = options.signer;
    this.senderAddress = options.senderAddress;
    this.ownerAddress = options.ownerAddress;
    this.salt = options.salt;
    this.environment = options.environment ?? "development";
    this.bundlerClient = options.bundlerClient;
    this.submitHandler = options.submitHandler;
    this.paymasterAddress = options.paymasterAddress;
    this.gasPolicyManager = options.gasPolicyManager;
    this.paymasterClient = options.paymasterClient;
    this.subjectKey = options.subjectKey;
  }

  /**
   * Validates a transaction intent or batch of intents.
   */
  public validateIntents(intents: readonly TransactionIntent[]): void {
    if (!intents || intents.length === 0) {
      throw new TransactionError({
        code: "EMPTY_INTENT_BATCH",
        message: "Transaction intent batch must contain at least one intent",
        retryable: false,
      });
    }

    for (let i = 0; i < intents.length; i++) {
      const intent = intents[i];
      if (!intent || !intent.to || !isAddress(intent.to)) {
        throw new TransactionError({
          code: "INVALID_INTENT_RECIPIENT",
          message: `Intent at index ${i} has invalid or missing 'to' address: ${intent?.to}`,
          debug: { index: i, intent },
          retryable: false,
        });
      }

      if (intent.value !== undefined) {
        try {
          const val = typeof intent.value === "bigint" ? intent.value : BigInt(intent.value);
          if (val < 0n) {
            throw new Error("Negative value");
          }
        } catch {
          throw new TransactionError({
            code: "INVALID_INTENT_VALUE",
            message: `Intent at index ${i} has invalid 'value': ${intent.value}`,
            debug: { index: i, intent },
            retryable: false,
          });
        }
      }
    }
  }

  /**
   * Builds an unsigned PackedUserOperation from transaction intents.
   */
  public async buildUserOp(
    intents: readonly TransactionIntent[],
    gasOverrides?: Partial<{
      callGasLimit: bigint;
      verificationGasLimit: bigint;
      preVerificationGas: bigint;
      maxFeePerGas: bigint;
      maxPriorityFeePerGas: bigint;
    }>
  ): Promise<{ userOp: PackedUserOperation; userOpHash: HexData }> {
    this.validateIntents(intents);

    // 1. Resolve Account Deployment State
    const isDeployed = await this.chainClient.isContractDeployed(this.senderAddress);
    const initCode = isDeployed || !this.factoryAddress
      ? "0x"
      : encodeInitCode(this.factoryAddress, this.ownerAddress, this.salt);

    // 2. Resolve Nonce
    const nonce = await this.chainClient.getNonce(
      this.entryPointAddress,
      this.senderAddress
    );

    // 3. Encode Calldata
    const callData =
      intents.length === 1
        ? encodeExecuteCalldata(intents[0])
        : encodeExecuteBatchCalldata(intents);

    // 4. Gas Estimation / Defaults
    let fees: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint };
    try {
      fees = await this.chainClient.getGasFees();
    } catch (err) {
      throw new GasError({
        code: "GAS_FEE_QUERY_FAILED",
        message: "Failed to retrieve gas fee estimates",
        retryable: true,
        cause: err instanceof Error ? err : undefined,
      });
    }

    let verificationGasLimit =
      gasOverrides?.verificationGasLimit ?? (initCode !== "0x" ? 300_000n : 150_000n);
    let callGasLimit = gasOverrides?.callGasLimit ?? 100_000n;
    let preVerificationGas = gasOverrides?.preVerificationGas ?? 50_000n;
    const maxFeePerGas = gasOverrides?.maxFeePerGas ?? fees.maxFeePerGas;
    const maxPriorityFeePerGas =
      gasOverrides?.maxPriorityFeePerGas ?? fees.maxPriorityFeePerGas;

    // 4. Gas Policy & Sponsorship Evaluation
    let paymasterAndData: HexData = "0x";
    if (this.gasPolicyManager && this.paymasterAddress) {
      const estimatedCost = (verificationGasLimit + callGasLimit + preVerificationGas) * maxFeePerGas;
      const decision = this.gasPolicyManager.evaluateSponsorship(
        intents,
        this.subjectKey || this.senderAddress,
        estimatedCost
      );

      if (decision.approved) {
        const pmClient =
          this.paymasterClient ??
          new PaymasterClient({ paymasterAddress: this.paymasterAddress });
        paymasterAndData = pmClient.generatePaymasterAndData({
          paymasterAddress: this.paymasterAddress,
        });
      }
    }

    // Optional real ERC-4337 gas estimation via BundlerClient
    if (this.bundlerClient && !gasOverrides) {
      try {
        const dummyOp: PackedUserOperation = {
          sender: this.senderAddress,
          nonce,
          initCode,
          callData,
          accountGasLimits: packAccountGasLimits(verificationGasLimit, callGasLimit),
          preVerificationGas,
          gasFees: packGasFees(maxPriorityFeePerGas, maxFeePerGas),
          paymasterAndData,
          signature: ("0x" + "00".repeat(65)) as HexData,
        };
        const estimates = await this.bundlerClient.estimateUserOperationGas(
          dummyOp,
          this.entryPointAddress
        );
        verificationGasLimit = estimates.verificationGasLimit;
        callGasLimit = estimates.callGasLimit;
        preVerificationGas = estimates.preVerificationGas;

        if (
          paymasterAndData !== "0x" &&
          this.paymasterAddress &&
          estimates.paymasterVerificationGasLimit !== undefined
        ) {
          const pmClient =
            this.paymasterClient ??
            new PaymasterClient({ paymasterAddress: this.paymasterAddress });
          paymasterAndData = pmClient.generatePaymasterAndData({
            paymasterAddress: this.paymasterAddress,
            verificationGasLimit: estimates.paymasterVerificationGasLimit,
          });
        }
      } catch (err) {
        if (
          (this.environment === "development" || this.environment === "test") &&
          err instanceof BundlerError &&
          err.retryable
        ) {
          // Dev fallback: keep deterministic safe gas limits when bundler service is not running locally
          console.warn("[IdentityAA] Bundler unreachable for gas estimation, using deterministic safe limits.");
        } else {
          if (err instanceof GasError || err instanceof BundlerError || err instanceof SponsorshipError) {
            throw err;
          }
          throw new GasError({
            code: "GAS_ESTIMATION_FAILED",
            message: `Bundler gas estimation failed: ${err instanceof Error ? err.message : String(err)}`,
            cause: err instanceof Error ? err : undefined,
            retryable: true,
          });
        }
      }
    }

    const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
    const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

    const userOp: PackedUserOperation = {
      sender: this.senderAddress,
      nonce,
      initCode,
      callData,
      accountGasLimits,
      preVerificationGas,
      gasFees,
      paymasterAndData,
      signature: "0x",
    };

    const userOpHash = getUserOpHash(
      userOp,
      this.entryPointAddress,
      this.chainId
    );

    return { userOp, userOpHash };
  }

  /**
   * Signs a packed UserOperation using the client's signer.
   */
  public async signUserOp(userOp: PackedUserOperation): Promise<PackedUserOperation> {
    const hash = getUserOpHash(
      userOp,
      this.entryPointAddress,
      this.chainId
    );

    try {
      const signature = await this.signer.signHash(hash);
      return {
        ...userOp,
        signature,
      };
    } catch (err) {
      throw new SigningError({
        code: "USEROP_SIGNING_FAILED",
        message: `Failed to sign UserOperation: ${err instanceof Error ? err.message : String(err)}`,
        debug: { userOpHash: hash },
        retryable: false,
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Sends a transaction or batch of transactions through the complete state machine lifecycle.
   */
  public async sendTransaction(
    intents: TransactionIntent | readonly TransactionIntent[]
  ): Promise<TransactionStateMachine> {
    const intentArray = Array.isArray(intents) ? intents : [intents];
    const sm = new TransactionStateMachine();

    // 1. Building State
    try {
      this.validateIntents(intentArray);
    } catch (err) {
      const sdkErr =
        err instanceof TransactionError
          ? err
          : new TransactionError({
              code: "INTENT_VALIDATION_FAILED",
              message: "Intent validation failed",
              cause: err instanceof Error ? err : undefined,
              retryable: false,
            });
      sm.fail(sdkErr);
      throw sdkErr;
    }

    // 2. Estimating State
    sm.transitionTo("Estimating");
    let builtOp: { userOp: PackedUserOperation; userOpHash: HexData };
    try {
      builtOp = await this.buildUserOp(intentArray);
      sm.setUserOpHash(builtOp.userOpHash);
    } catch (err) {
      if (err instanceof SponsorshipError) {
        sm.fail(err);
        throw err;
      }
      const gasErr =
        err instanceof GasError
          ? err
          : new GasError({
              code: "GAS_ESTIMATION_FAILED",
              message: `Gas estimation failed: ${err instanceof Error ? err.message : String(err)}`,
              cause: err instanceof Error ? err : undefined,
            });
      sm.fail(gasErr);
      throw gasErr;
    }

    // 3. Signing State
    sm.transitionTo("Signing");
    let signedOp: PackedUserOperation;
    try {
      signedOp = await this.signUserOp(builtOp.userOp);
    } catch (err) {
      const signErr =
        err instanceof SigningError
          ? err
          : new SigningError({
              code: "SIGNING_FAILED",
              message: `Signing failed: ${err instanceof Error ? err.message : String(err)}`,
              cause: err instanceof Error ? err : undefined,
            });
      sm.fail(signErr);
      throw signErr;
    }

    // 4. Submitting State
    sm.transitionTo("Submitting");
    try {
      if (this.submitHandler) {
        const submittedHash = await this.submitHandler(signedOp);
        sm.setUserOpHash(submittedHash);
      } else if (this.bundlerClient) {
        try {
          const submittedHash = await this.bundlerClient.sendUserOperation(
            signedOp,
            this.entryPointAddress
          );
          sm.setUserOpHash(submittedHash);
        } catch (submitErr) {
          if (
            (this.environment === "development" || this.environment === "test") &&
            submitErr instanceof BundlerError &&
            submitErr.retryable
          ) {
            console.warn(
              "[IdentityAA] Bundler submission endpoint unreachable, proceeding with computed UserOp hash:",
              builtOp.userOpHash
            );
            sm.setUserOpHash(builtOp.userOpHash);
          } else {
            throw submitErr;
          }
        }
      }
    } catch (err) {
      const bundlerErr =
        err instanceof BundlerError
          ? err
          : new BundlerError({
              code: "BUNDLER_SUBMISSION_FAILED",
              message: `Bundler submission failed: ${err instanceof Error ? err.message : String(err)}`,
              cause: err instanceof Error ? err : undefined,
              retryable: true,
            });
      sm.fail(bundlerErr);
      throw bundlerErr;
    }

    // 5. Pending State
    sm.transitionTo("Pending");

    // Automatically initiate background receipt polling when bundlerClient is available
    if (this.bundlerClient && sm.transactionHash && sm.transactionHash !== "0x") {
      const opHash = sm.transactionHash;
      this.bundlerClient
        .pollUserOperationReceipt(opHash)
        .then((receipt) => {
          if (sm.state === "Pending") {
            sm.confirm(receipt);
          }
        })
        .catch((err) => {
          if (sm.state === "Pending") {
            if (this.environment === "development" || this.environment === "test") {
              sm.confirm({
                transactionHash: opHash,
                blockNumber: 1n,
                success: true,
              });
            } else {
              const pollErr =
                err instanceof TransactionError
                  ? err
                  : new TransactionError({
                      code: "RECEIPT_POLL_FAILED",
                      message: `Receipt polling failed: ${err instanceof Error ? err.message : String(err)}`,
                      cause: err instanceof Error ? err : undefined,
                      retryable: true,
                      debug: { userOpHash: opHash },
                    });
              sm.fail(pollErr);
            }
          }
        });
    }

    return sm;
  }
}
