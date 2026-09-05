/**
 * @identity-aa-sdk/core - Local Signer Implementation
 * Specification from docs/KEY_MANAGEMENT.md
 */

import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { type HexAddress, type HexData, type Signer } from "../../types/account.js";
import { SigningError } from "../../errors/categories.js";

/**
 * LocalSigner manages an ECDSA secp256k1 keypair for signing smart account operations.
 */
export class LocalSigner implements Signer {
  readonly keyId: string;
  private readonly account: PrivateKeyAccount;

  private constructor(account: PrivateKeyAccount, keyId?: string) {
    this.account = account;
    this.keyId = keyId ?? `signer_${account.address.toLowerCase()}`;
  }

  /**
   * Generates a new random ECDSA keypair.
   */
  static create(keyId?: string): LocalSigner {
    try {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      return new LocalSigner(account, keyId);
    } catch (err: unknown) {
      throw new SigningError({
        code: "KEY_GENERATION_FAILED",
        message: "Failed to generate local signing keypair",
        retryable: false,
        debug: { error: err instanceof Error ? err.message : String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Creates a LocalSigner from an existing private key hex string.
   */
  static fromPrivateKey(privateKey: `0x${string}`, keyId?: string): LocalSigner {
    try {
      const account = privateKeyToAccount(privateKey);
      return new LocalSigner(account, keyId);
    } catch (err: unknown) {
      throw new SigningError({
        code: "INVALID_PRIVATE_KEY",
        message: "Failed to instantiate signer from private key",
        retryable: false,
        debug: { error: err instanceof Error ? err.message : String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Returns the Ethereum address of the signer.
   */
  async getAddress(): Promise<HexAddress> {
    return this.account.address as HexAddress;
  }

  /**
   * Produces an Ethereum signed message signature (EIP-191).
   */
  async signMessage(message: Uint8Array | string): Promise<HexData> {
    try {
      const sig = await this.account.signMessage({
        message: typeof message === "string" ? message : { raw: message },
      });
      return sig as HexData;
    } catch (err: unknown) {
      throw new SigningError({
        code: "MESSAGE_SIGNING_FAILED",
        message: "Failed to sign message",
        retryable: false,
        debug: { error: err instanceof Error ? err.message : String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Signs a 32-byte digest / hash directly.
   */
  async signHash(hash: HexData | Uint8Array): Promise<HexData> {
    try {
      const hashHex: `0x${string}` =
        typeof hash === "string" ? hash : (`0x${Buffer.from(hash).toString("hex")}` as `0x${string}`);
      const sig = await this.account.sign({ hash: hashHex });
      return sig as HexData;
    } catch (err: unknown) {
      throw new SigningError({
        code: "HASH_SIGNING_FAILED",
        message: "Failed to sign digest hash",
        retryable: false,
        debug: { error: err instanceof Error ? err.message : String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }
  }
}
