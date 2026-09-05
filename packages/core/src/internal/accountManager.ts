/**
 * @identity-aa-sdk/core - Account Manager
 * Implements identity -> AccountKey -> counterfactual address -> Account resolution with caching.
 * Specification from docs/phases/PHASE_05_ACCOUNT_MANAGER.md and docs/IDENTITY_ARCHITECTURE.md.
 */

import { encodePacked, keccak256, getContractAddress } from "viem";
import type { SDKConfig } from "../config/schema.js";
import type { AppIdentity, AccountKey, IdentityResolver } from "../types/identity.js";
import type { Account, HexAddress, HexData, Signer } from "../types/account.js";
import type { TransactionIntent, TransactionHandle } from "../types/transaction.js";
import type { SponsorshipPolicy } from "../types/sponsorship.js";
import { AccountError, IdentityError } from "../errors/categories.js";
import { LocalSigner } from "./signer/signer.js";
import { type KeyStore, InMemoryKeyStore } from "./signer/keystore.js";
import { deriveAccountSalt } from "./salt.js";
import { ChainClient } from "./chain.js";
import { BundlerClient } from "./bundler/bundlerClient.js";
import { GasPolicyManager } from "./gasPolicy/gasPolicy.js";
import { TransactionEngine } from "./transactionEngine/index.js";

export interface AccountManagerOptions {
  readonly config: SDKConfig;
  readonly resolver?: IdentityResolver;
  readonly keyStore?: KeyStore;
  readonly chainClient?: ChainClient;
  readonly bundlerClient?: BundlerClient;
  readonly gasPolicyManager?: GasPolicyManager;
}

/**
 * AccountManager coordinates identity resolution, deterministic signer retrieval/generation,
 * counterfactual address calculation, and caching.
 */
export class AccountManager {
  private readonly config: SDKConfig;
  private readonly resolver?: IdentityResolver;
  private readonly keyStore: KeyStore;
  private readonly chainClient: ChainClient;
  private readonly bundlerClient: BundlerClient;
  private readonly gasPolicyManager: GasPolicyManager;
  private readonly accountCache = new Map<string, Account>();

  constructor(options: AccountManagerOptions) {
    this.config = options.config;
    this.resolver = options.resolver;
    this.keyStore = options.keyStore ?? new InMemoryKeyStore();
    this.chainClient = options.chainClient ?? new ChainClient(options.config.network.rpcUrl);
    this.bundlerClient =
      options.bundlerClient ??
      new BundlerClient({
        bundlerUrl: options.config.network.bundlerUrl ?? "http://127.0.0.1:4337",
        entryPointAddress: options.config.network.entryPointAddress,
      });
    this.gasPolicyManager =
      options.gasPolicyManager ??
      new GasPolicyManager(options.config.sponsorship, options.config.environment);
  }

  /**
   * Updates runtime sponsorship policy dynamically.
   */
  public configure(options: { sponsorship?: SponsorshipPolicy }): void {
    if (options.sponsorship !== undefined) {
      this.gasPolicyManager.setPolicy(options.sponsorship);
    }
  }

  /**
   * Resolves the smart account for the current identity.
   * If identity is omitted, it is retrieved via the configured IdentityResolver.
   */
  async getAccount(identityParam?: AppIdentity): Promise<Account> {
    let identity: AppIdentity;

    if (identityParam) {
      identity = identityParam;
    } else if (this.resolver) {
      identity = await this.resolver.resolve();
    } else {
      throw new IdentityError({
        code: "MISSING_IDENTITY_RESOLVER",
        message: "No IdentityResolver configured and no AppIdentity provided to getAccount()",
        retryable: false,
      });
    }

    const chainId = this.config.network.chainId;
    const cacheKey = `${identity.provider}:${identity.subjectId}:${identity.namespace ?? ""}:${chainId}`;

    // Return cached instance if available
    const cached = this.accountCache.get(cacheKey);
    if (cached) {
      // Refresh deployment status
      const isDeployed = await this.chainClient.isContractDeployed(cached.address);
      if (isDeployed !== cached.isDeployed) {
        // Re-create with updated deployment status
        const signer = await this.keyStore.get(`signer_${identity.provider}_${identity.subjectId}_${chainId}`);
        const signerAddress = signer ? await signer.getAddress() : "0x0000000000000000000000000000000000000000" as HexAddress;
        const salt = deriveAccountSalt({
          identity,
          chainId,
          accountImplementationVersion: "1.0.0",
          signerKeyId: signer?.keyId ?? "",
        });
        const updated = this._createAccountObject(
          cached.address,
          isDeployed,
          chainId,
          signer,
          signerAddress,
          salt,
          identity.subjectId
        );
        this.accountCache.set(cacheKey, updated);
        return updated;
      }
      return cached;
    }

    try {
      // 1. Retrieve or generate local signer
      const keyLookupId = `signer_${identity.provider}_${identity.subjectId}_${chainId}`;
      let signer = await this.keyStore.get(keyLookupId);

      if (!signer) {
        signer = LocalSigner.create(keyLookupId);
        await this.keyStore.save(keyLookupId, signer);
      }

      const signerAddress = await signer.getAddress();

      // 2. Build AccountKey tuple
      const accountKey: AccountKey = {
        identity,
        chainId,
        accountImplementationVersion: "1.0.0",
        signerKeyId: signer.keyId,
      };

      // 3. Derive deterministic CREATE2 salt
      const salt = deriveAccountSalt(accountKey);

      // 4. Compute counterfactual address
      let accountAddress: HexAddress;

      if (this.config.network.factoryAddress) {
        accountAddress = await this.chainClient.getCounterfactualAddress(
          this.config.network.factoryAddress,
          signerAddress,
          salt
        );
      } else {
        // Fallback calculation using standard CREATE2 formula if factoryAddress is omitted
        accountAddress = getContractAddress({
          from: this.config.network.entryPointAddress,
          opcode: "CREATE2",
          salt,
          bytecodeHash: keccak256(encodePacked(["address", "bytes32"], [signerAddress, salt])),
        });
      }

      // 5. Query on-chain deployment state
      const isDeployed = await this.chainClient.isContractDeployed(accountAddress);

      // 6. Construct Account representation
      const account = this._createAccountObject(
        accountAddress,
        isDeployed,
        chainId,
        signer,
        signerAddress,
        salt,
        identity.subjectId
      );

      // 7. Store in session cache
      this.accountCache.set(cacheKey, account);

      return account;
    } catch (err: unknown) {
      if (err instanceof IdentityError || err instanceof AccountError) {
        throw err;
      }
      throw new AccountError({
        code: "ACCOUNT_RESOLUTION_FAILED",
        message: "Failed to resolve smart account for identity",
        retryable: true,
        debug: { identity, error: err instanceof Error ? err.message : String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Internal helper constructing the public Account object.
   */
  private _createAccountObject(
    address: HexAddress,
    isDeployed: boolean,
    chainId: number,
    signer: Signer | null,
    signerAddress: HexAddress,
    salt: HexData,
    subjectKey?: string
  ): Account {
    return {
      address,
      isDeployed,
      chainId,
      sendTransaction: async (intent: TransactionIntent): Promise<TransactionHandle> => {
        if (!signer) {
          throw new AccountError({
            code: "SIGNER_UNAVAILABLE",
            message: "Signing key is unavailable for this account instance",
            retryable: false,
          });
        }
        const engine = new TransactionEngine({
          chainClient: this.chainClient,
          entryPointAddress: this.config.network.entryPointAddress,
          factoryAddress: this.config.network.factoryAddress,
          chainId,
          signer,
          senderAddress: address,
          ownerAddress: signerAddress,
          salt,
          environment: this.config.environment,
          bundlerClient: this.bundlerClient,
          paymasterAddress: this.config.network.paymasterAddress,
          gasPolicyManager: this.gasPolicyManager,
          subjectKey,
        });
        return engine.sendTransaction(intent);
      },
      execute: async (intents: TransactionIntent[]): Promise<TransactionHandle> => {
        if (!signer) {
          throw new AccountError({
            code: "SIGNER_UNAVAILABLE",
            message: "Signing key is unavailable for this account instance",
            retryable: false,
          });
        }
        const engine = new TransactionEngine({
          chainClient: this.chainClient,
          entryPointAddress: this.config.network.entryPointAddress,
          factoryAddress: this.config.network.factoryAddress,
          chainId,
          signer,
          senderAddress: address,
          ownerAddress: signerAddress,
          salt,
          environment: this.config.environment,
          bundlerClient: this.bundlerClient,
          paymasterAddress: this.config.network.paymasterAddress,
          gasPolicyManager: this.gasPolicyManager,
          subjectKey,
        });
        return engine.sendTransaction(intents);
      },
      async signMessage(message: Uint8Array | string): Promise<HexData> {
        if (!signer) {
          throw new AccountError({
            code: "SIGNER_UNAVAILABLE",
            message: "Signing key is unavailable for this account instance",
            retryable: false,
          });
        }
        return signer.signMessage(message);
      },
    };
  }
}
