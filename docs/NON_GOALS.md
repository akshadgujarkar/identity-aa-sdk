# Non-Goals

The MVP explicitly will NOT build or include:

- A custom blockchain.
- A custom EntryPoint implementation (the canonical/standard
  EntryPoint is used as-is).
- A custom bundler (a standard-compliant bundler is used/hosted, not
  built from scratch).
- A full standalone wallet application or wallet UI.
- MPC-based key management.
- Support for identity providers other than Clerk.
- Support for more than one configured chain at a time.
- Every account-abstraction feature in the ERC-4337 spec (e.g.
  signature aggregation, aggregator contracts, custom nonce keys,
  EIP-7702 delegation).
- Advanced signature aggregation.
- Account upgradeability.
- Key rotation or multi-owner/multi-device account access.
- Account recovery.
- Session keys / spending limits.
- ERC-20 ("token gas") paymaster support.
- Transaction cancel/replace-by-fee-bump.
- A general-purpose, production-hardened paymaster (the MVP paymaster
  is demo-scoped only).

This document exists so that no phase silently expands scope. Any
implementation work matching an item above belongs to
`docs/ROADMAP.md`, not the MVP phases in `docs/IMPLEMENTATION_PHASES.md`.
