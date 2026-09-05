# ERC-4337 Internal Mapping (Internal Document)

This document is for maintainers/Antigravity, not application
developers (see `DOCUMENTATION_STRATEGY.md`).

## Concept Classification

| ERC-4337 Concept | Classification | Internal SDK Component | Developer-Facing Abstraction | Reason |
|---|---|---|---|---|
| Account (Smart Contract Account) | MVP | Smart Account contract | `account` object | Core requirement |
| UserOperation | MVP, Internal only | Transaction Engine | `sendTransaction()` / `execute()` | Must never be developer-constructed |
| PackedUserOperation | MVP, Internal only | Transaction Engine (submission encoding) | none | Pure wire-format detail |
| EntryPoint | MVP, Internal only | Bundler Client / Transaction Engine | none (config only, see `CONFIGURATION.md`) | Fixed per chain, not a per-call concept |
| Factory | MVP, Internal only | Account Factory | implicit in `getAccount()` | Deployment timing is automatic |
| Bundler | MVP, Internal only | Bundler Client | none | Pure infra |
| Paymaster | MVP, Internal only | Gas Policy / Paymaster Client | `sponsorship` config | Developer sets policy, not paymaster wiring |
| Aggregator | Not implemented | — | — | Out of scope; no batching-across-senders use case in MVP |
| Nonce (key + sequence) | MVP (key=0 only) | Transaction Engine | none | Custom nonce keys deferred (`NON_GOALS.md`) |
| Simulation (validation-only view call) | MVP, Internal only | Bundler Client (pre-submission checks; primarily a bundler-side concern) | none | Not something the SDK re-implements; relies on bundler compliance |
| EIP-712 (userOpHash signing) | MVP, Internal only | Signer / Key Management | none | Signature scheme detail |
| validationData (aggregator/validUntil/validAfter packing) | MVP, Internal only | Smart Account / Transaction Engine | none | MVP does not use time-bounded validity beyond defaults (no aggregator) |
| Signature aggregation | Not implemented | — | — | No aggregator use case in MVP |
| EIP-7702 | Future | — | — | Roadmap; MVP uses factory-based CREATE2 deployment, not EOA delegation |
| Token gas payment (ERC-20 paymaster) | Future | — | — | MVP paymaster sponsors in native gas terms only |
| Advanced account features (session keys, spending limits, multi-owner, recovery) | Future | — | — | See `ROADMAP.md` |

## Example Mapping Chain

```text
UserOperation
    ↓
Transaction Engine
    ↓
sendTransaction()
```

```text
EntryPoint.getNonce
    ↓
Transaction Engine (nonce resolution step)
    ↓
(no public surface — automatic)
```

```text
Paymaster.validatePaymasterUserOp / postOp
    ↓
Gas Policy + Paymaster Client
    ↓
sdk.configure({ sponsorship })
```

## Usage Note

This document is the authoritative cross-reference when a phase
document (`docs/phases/`) needs to justify *why* a given ERC-4337
concept is or isn't exposed. It is not shipped as user-facing SDK
documentation.
