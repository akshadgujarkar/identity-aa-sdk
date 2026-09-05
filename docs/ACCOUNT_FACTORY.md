# Account Factory

## Purpose

Deploys a Smart Account deterministically, and lets the SDK compute
the account's address **before** deployment.

## Deterministic Address (CREATE2)

The factory MUST use `CREATE2` so the account address depends only on:

```text
address = f(factoryAddress, salt, initCodeHash)
```

where `salt` is derived from the `AccountKey` defined in
`IDENTITY_ARCHITECTURE.md` (identity + chain + implementation version
+ signer key reference), and `initCodeHash` is fixed by the account
implementation + owner key baked into the init call.

## How the SDK Knows the Address Before Deployment

1. SDK computes `AccountKey` for the resolved identity.
2. SDK calls a read-only "counterfactual address" method (mirroring
   ERC-4337's `entryPoint.getSenderAddress()` pattern) against the
   factory, passing the same `initCode`/salt it would use for real
   deployment.
3. The returned address is authoritative and stable regardless of
   whether deployment has happened yet.

This MUST be a pure/view computation — no state mutation, no gas cost,
callable at any time, including before the user has ever transacted.

## Deployment Trigger

- The account is **not** deployed at login or at `getAccount()` time.
- Deployment occurs as a side effect of the account's first
  UserOperation: the factory address + init calldata are included as
  the UserOperation's `initCode`, and the EntryPoint deploys the
  account during the verification loop of that first operation (per
  ERC-4337 first-time-creation semantics).

## Idempotency

- If the account is already deployed, the factory method that would
  deploy it MUST simply return the existing address rather than
  reverting (mirrors ERC-4337 factory expectations, and lets bundlers
  safely query the address without knowing deployment state).

## Account Salt / Identity Mapping

- Salt = deterministic hash of `AccountKey`. The salt MUST be
  reproducible independently by the SDK (not stored as an opaque
  server-issued value) so that address computation does not depend on
  any centralized database.

## Undeployed Accounts / First Transaction

- An undeployed account can still receive funds (its address is valid
  ahead of deployment, as with any CREATE2 address).
- Its first outbound transaction is the one that carries `initCode`
  and triggers deployment; every subsequent transaction omits
  `initCode` and MUST fail deployment if the account already exists
  (per ERC-4337 abort-on-existing-sender rule) — this is a bundler/
  EntryPoint-level invariant the factory must be compatible with, not
  something the factory re-implements.

## Required Factory Behavior Summary

| Behavior | Required |
|---|---|
| CREATE2-based deployment | Yes |
| Idempotent deploy call (returns existing address) | Yes |
| Pure/view counterfactual address computation | Yes |
| Deployment restricted to calls originating via EntryPoint's sender-creator path | Yes (per ERC-4337 factory rule) |
| Arbitrary/attacker-supplied salt independent of signature | No — salt must be tied to the account's own owner key material, per ERC-4337 rationale that the generated address must depend on the initial signature |
