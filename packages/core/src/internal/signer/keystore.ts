/**
 * @identity-aa-sdk/core - KeyStore Interface and In-Memory Implementation
 * Specification from docs/KEY_MANAGEMENT.md
 */

import type { Signer } from "../../types/account.js";

/**
 * Storage interface for client-held non-extractable signing keys.
 */
export interface KeyStore {
  /** Retrieve a stored signer by key identifier */
  get(keyId: string): Promise<Signer | null>;
  /** Store a signer under a key identifier */
  save(keyId: string, signer: Signer): Promise<void>;
  /** Remove a stored signer */
  delete(keyId: string): Promise<void>;
}

/**
 * In-memory key store for environments without persistent storage (Node.js, tests, server).
 */
export class InMemoryKeyStore implements KeyStore {
  private readonly store = new Map<string, Signer>();

  async get(keyId: string): Promise<Signer | null> {
    return this.store.get(keyId) ?? null;
  }

  async save(keyId: string, signer: Signer): Promise<void> {
    this.store.set(keyId, signer);
  }

  async delete(keyId: string): Promise<void> {
    this.store.delete(keyId);
  }

  /** Clear all keys */
  clear(): void {
    this.store.clear();
  }
}
