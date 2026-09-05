# Roadmap

```text
MVP
 ↓
v1
 ↓
v2
 ↓
Future
```

## MVP (see `IMPLEMENTATION_PHASES.md`)
Clerk login → deterministic smart account → account dashboard → one
sponsored transaction → confirmation, entirely through the SDK.

## v1 (candidate)
- Passkeys / WebAuthn as the account's signature scheme (requires a
  passkey-verifying smart-account implementation).
- Key rotation for the existing single-owner model.

## v2 (candidate)
- Multi-device account access (multi-owner smart account support).
- Session keys for scoped/delegated signing.
- Social/guardian account recovery.

## Future (candidate)
- Spending limits.
- Batch transactions beyond the MVP's basic `execute` (advanced
  scheduling/ordering).
- Token-denominated ("ERC-20") gas payment via paymaster.
- Additional identity providers beyond Clerk.
- Additional chains (multi-chain configuration — additive given
  `AccountKey` already carries `chainId`).
- EIP-7702-based account delegation as an alternative to factory-based
  deployment.
- Account portability across implementations/chains.
- Enterprise sponsorship policies (org-level allowlists, budgets).

Future features MUST NOT be implemented during an MVP phase unless a
phase document in `docs/phases/` explicitly requires them (see
`ANTIGRAVITY_GUIDE.md`, No Scope Creep).
