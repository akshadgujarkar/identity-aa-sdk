/**
 * @identity-aa-sdk/core - Identity Types
 * Specifications from docs/IDENTITY_ARCHITECTURE.md
 */

/**
 * AppIdentity represents the authenticated Web2 identity tuple.
 */
export interface AppIdentity {
  /** The identity provider (e.g. "clerk") */
  readonly provider: string;
  /** The provider's unique user identifier */
  readonly subjectId: string;
  /** Application or tenant identifier */
  readonly namespace?: string;
  /** Optional email associated with the user for display purposes */
  readonly email?: string;
}

/**
 * AccountKey is the deterministic input used to derive CREATE2 salts and smart account addresses.
 * Must include identity, chainId, account implementation version, and signerKeyId.
 */
export interface AccountKey {
  /** The authenticated AppIdentity */
  readonly identity: AppIdentity;
  /** Target EVM chain ID */
  readonly chainId: number;
  /** Smart account implementation version string (e.g., "1.0.0") */
  readonly accountImplementationVersion: string;
  /** Reference or fingerprint of the client-side signing key */
  readonly signerKeyId: string;
}

/**
 * Interface that all identity adapters (e.g. Clerk, Auth0) must implement.
 */
export interface IdentityResolver {
  resolve(): Promise<AppIdentity>;
}
