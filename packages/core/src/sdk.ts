/**
 * @identity-aa-sdk/core - Main SDK Client Entry Point
 * Specifications defined in docs/API_DESIGN.md and docs/SDK_ARCHITECTURE.md.
 */

import { validateConfig } from "./config/validator.js";
import type { SDKConfig } from "./config/schema.js";
import type { AppIdentity, IdentityResolver } from "./types/identity.js";
import type { Account } from "./types/account.js";
import type { SponsorshipPolicy } from "./types/sponsorship.js";
import { AccountManager } from "./internal/accountManager.js";
import type { KeyStore } from "./internal/signer/keystore.js";

export interface IdentityAASDKOptions {
  readonly config: SDKConfig;
  readonly resolver: IdentityResolver;
  readonly keyStore?: KeyStore;
}

/**
 * Main SDK client instance.
 */
export class IdentityAASDK {
  private _config: SDKConfig;
  private readonly resolver: IdentityResolver;
  private readonly accountManager: AccountManager;

  constructor(options: IdentityAASDKOptions) {
    this._config = validateConfig(options.config);
    this.resolver = options.resolver;
    this.accountManager = new AccountManager({
      config: this._config,
      resolver: options.resolver,
      keyStore: options.keyStore,
    });
  }

  /**
   * Returns current validated SDK configuration.
   */
  get config(): SDKConfig {
    return this._config;
  }

  /**
   * Resolves the smart account bound to the current authenticated identity.
   */
  async getAccount(identity?: AppIdentity): Promise<Account> {
    return this.accountManager.getAccount(identity);
  }

  /**
   * Dynamically updates the gas sponsorship policy for subsequent transactions.
   */
  configure(options: { sponsorship?: SponsorshipPolicy }): void {
    if (options.sponsorship !== undefined) {
      this._config = validateConfig({
        ...this._config,
        sponsorship: options.sponsorship,
      });
    }
  }
}

/**
 * Factory function for creating an IdentityAASDK client instance.
 */
export function createIdentityAASDK(options: IdentityAASDKOptions): IdentityAASDK {
  return new IdentityAASDK(options);
}
