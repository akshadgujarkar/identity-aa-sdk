# Key Management

## Foundational Statement

```text
Clerk Authentication  ≠  Blockchain Private Key
```

Clerk authenticates the user. It never generates, holds, or is
treated as equivalent to the key that signs UserOperations for the
user's smart account. This separation is load-bearing for the
project's self-custody claims (see `SECURITY.md`).

## Candidate Approaches (evaluated)

| Approach | MVP-suitable? | Notes |
|---|---|---|
| Browser/device-held key (WebCrypto, non-extractable, IndexedDB-backed) | **Yes — chosen for MVP** | No extension install, key never leaves the device unencrypted, works with a standard ECDSA-owner smart account. |
| WebAuthn / Passkeys as the account's signature scheme | No (roadmap) | Requires a passkey-verifying smart-account implementation (secp256r1 verification), more account-contract complexity than MVP scope allows. |
| Backend-controlled key | No | Reintroduces custody at the backend; contradicts self-custody positioning unless explicitly marketed as custodial. |
| MPC | No (roadmap) | Real complexity and infra cost not justified for MVP. |
| Session keys | No (roadmap) | Useful for scoped/delegated signing later; not required to prove the core thesis. |

## Chosen MVP Approach

A **non-extractable WebCrypto keypair, generated client-side and
persisted in IndexedDB**, scoped to the (identity, device) pair. This
key is the account's owner key (see `SMART_ACCOUNT.md`).

```text
Clerk User (authenticated)
        ↓
SDK (client-side)
        ↓
Retrieve existing local signer, or generate one
        ↓
Smart Account owner key
```

## Trust Boundaries

- The key exists only in the browser/device's secure storage; it is
  never transmitted to the application backend or to Anthropic-
  unrelated third parties.
- The application backend may know the account's *address* (public)
  but never the key material.

## Key Generation

- Generated on first `getAccount()` call for a device that has no
  existing local signer for the current identity, using the Web
  Crypto API with non-extractable key usage where supported.

## Storage

- IndexedDB, scoped per-origin (browser-enforced) and per (identity,
  chain) pair, so switching Clerk users on the same device does not
  cross-contaminate signers.

## Signing

- All UserOperation-hash and message signing happens client-side,
  invoked by the Transaction Engine, never by the backend.

## Recovery (MVP position)

- **Not implemented in the MVP.** If the local key/device is lost, the
  account is not recoverable in the MVP. This limitation MUST be
  stated explicitly in developer- and user-facing docs (see
  `USER_EXPERIENCE.md`) rather than hidden. Recovery mechanisms are a
  first-class roadmap item (see `ROADMAP.md`), and the smart account's
  owner-storage design (`SMART_ACCOUNT.md`) must not preclude adding
  one later.

## Rotation

- Not implemented in the MVP (owner key is immutable per
  `SMART_ACCOUNT.md`). Roadmap item.

## Logout / Session Expiration

- Logging out of Clerk does not delete the local signing key (the key
  is device-scoped, not session-scoped); re-authenticating as the same
  Clerk user on the same device must resolve to the same account.
- The SDK MUST NOT treat Clerk session expiration as a reason to
  regenerate or discard the local key.

## Compromised Device

- If the device is compromised, the local key is compromised. This is
  an accepted MVP risk boundary, documented in `SECURITY.md`, mitigated
  long-term by moving toward WebAuthn/passkey-backed signing.

## Compromised Frontend

- A compromised frontend bundle could exfiltrate signing requests (not
  raw key material, since the key is non-extractable) and trick the
  user into approving malicious transactions. Mitigation is primarily
  supply-chain integrity of the frontend, outside SDK scope; documented
  as a residual risk in `SECURITY.md`.

## Compromised Backend

- Because the backend never holds signing material, a compromised
  backend cannot directly move funds from a user's smart account. It
  could still tamper with sponsorship policy or Clerk session
  verification — see `SECURITY.md` for the corresponding threats.
