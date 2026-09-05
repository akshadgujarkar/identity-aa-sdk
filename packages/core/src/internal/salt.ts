/**
 * @identity-aa-sdk/core - Deterministic Salt Derivation
 * Specification from docs/IDENTITY_ARCHITECTURE.md and docs/ACCOUNT_FACTORY.md
 */

import { encodePacked, keccak256 } from "viem";
import type { AccountKey } from "../types/identity.js";
import type { HexData } from "../types/account.js";

/**
 * Derives the deterministic CREATE2 salt from an AccountKey tuple.
 * Salt is independent of central databases and verifiable across SDK instances.
 */
export function deriveAccountSalt(accountKey: AccountKey): HexData {
  const { identity, chainId, accountImplementationVersion, signerKeyId } = accountKey;
  const provider = identity.provider;
  const subjectId = identity.subjectId;
  const namespace = identity.namespace ?? "";

  const encoded = encodePacked(
    ["string", "string", "string", "uint256", "string", "string"],
    [provider, subjectId, namespace, BigInt(chainId), accountImplementationVersion, signerKeyId]
  );

  return keccak256(encoded) as HexData;
}
