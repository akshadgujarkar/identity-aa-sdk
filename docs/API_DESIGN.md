# API Design

Public API is organized around six nouns: `identity`, `account`,
`transaction`, `message`, `sponsorship`, `receipt`. It is never
organized around `UserOperation`, `EntryPoint`, `Bundler`,
`Paymaster`, or `NonceKey` — those remain internal (see
`docs/ERC4337_INTERNAL_MAPPING.md`).

Every method below is illustrative of shape and contract only. This
document does not authorize implementation; Antigravity implements the
described behavior in the phase corresponding to the module.

## `sdk.getAccount()`

- **Purpose**: resolve the smart account bound to the current
  authenticated identity, creating a counterfactual (undeployed)
  reference if none exists yet.
- **Inputs**: none (identity comes from the configured resolver).
- **Outputs**: an `Account` object exposing `address`, `isDeployed`,
  `chainId`, and the transaction/message methods below.
- **Lifecycle**: idempotent; cached per identity for the life of the
  SDK instance.
- **Errors**: `IdentityError` (no authenticated identity),
  `AccountError` (resolution failed).
- **Security considerations**: must not perform any signing; purely
  derives/reads an address and deployment state.
- **Internal behavior**: identity → deterministic address derivation
  → on-chain deployment-state check. See `IDENTITY_ARCHITECTURE.md`,
  `ACCOUNT_FACTORY.md`.
- **Public.**

## `account.sendTransaction(intent)`

- **Purpose**: execute one on-chain call (or, per `execute`, a batch)
  from the user's smart account.
- **Inputs**: `{ to, value?, data? }` (or an array for batch, exposed
  as `account.execute([...])`).
- **Outputs**: a `TransactionHandle` with `wait()` resolving to a
  `Receipt`.
- **Lifecycle**: fire-and-track; see state machine in
  `TRANSACTION_ENGINE.md`.
- **Errors**: `TransactionError`, `GasError`, `SponsorshipError`,
  `BundlerError`, `ContractExecutionError` (all subtypes of a common
  SDK error — see `ERROR_MODEL.md`).
- **Security considerations**: the intent's `to`/`data` are opaque to
  the SDK; the SDK does not evaluate contract-call safety.
- **Internal behavior**: account resolution → nonce resolution → gas
  estimation → UserOperation construction → signing → optional
  sponsorship → bundler submission → receipt polling. See
  `TRANSACTION_ENGINE.md`.
- **Public.**

## `account.execute(intents[])`

- Same contract as `sendTransaction`, batched into a single
  UserOperation. Public.

## `account.signMessage(message)`

- **Purpose**: produce an off-chain signature attributable to the
  smart account (e.g. for EIP-712 flows outside transaction
  execution).
- **Outputs**: signature bytes plus the scheme used.
- **Errors**: `SigningError`.
- **Public.**

## `account.waitForTransaction(handle)`

- Convenience wrapper equivalent to `handle.wait()`. Public.

## `sdk.configure({ sponsorship })`

- **Purpose**: set the gas sponsorship policy for subsequent
  transactions (see `GAS_ABSTRACTION.md`). Public, configuration-only
  — never exposes paymaster wiring.

## Internal-Only Equivalents (never exported)

`buildUserOperation()`, `getUserOpHash()`, `sendUserOperation()`,
`getEntryPoint()`, `estimateUserOperationGas()`, `getNonce(key)`. These
exist inside `core/internal` and are exercised by
`TRANSACTION_ENGINE.md` and `BUNDLER.md`.

## Public API Abstraction Test

For every candidate public method, ask: *does the developer need to
understand ERC-4337 to use this?* If yes, the method is redesigned or
moved to `core/internal`. This test is binding on all future API
additions (see `docs/DESIGN_DECISIONS.md`).
