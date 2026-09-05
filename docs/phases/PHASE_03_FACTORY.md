# Phase 03 — Account Factory

## Objective
Implement the CREATE2-based Account Factory per
`docs/ACCOUNT_FACTORY.md`.

## Why This Phase Exists
The SDK's `getAccount()` (Phase 5) cannot compute or create real
addresses without a deployed, spec-compliant factory.

## Dependencies
Phase 2 (Smart Account contract + init call signature).

## Inputs
`docs/ACCOUNT_FACTORY.md`, ERC-4337 "First-time Smart Contract Account
creation" section (source document 3).

## Files/Modules to Implement
`contracts/SmartAccountFactory`.

## Interfaces Required
Deploy function usable as ERC-4337 `initCode` target; a pure/view
counterfactual-address function.

## Behavior Required
CREATE2 deployment; idempotent deploy (returns existing address if
already deployed); salt derived from identity-bound `AccountKey` (not
arbitrary); deployment restricted to the EntryPoint sender-creator
path per ERC-4337 factory rule.

## Security Requirements
No unrestricted public deploy-to-arbitrary-address function; salt
must incorporate the owner key material per `docs/ACCOUNT_FACTORY.md`.

## Testing Requirements
Contract tests: address computed via view call matches address after
real deployment; idempotency; deployment rejected from non-EntryPoint
origin; different `AccountKey`s never collide.

## Acceptance Criteria
All tests above pass on the local chain.

## Definition of Done
A previously-undeployed account can be deployed as the side effect of
its first UserOperation (manual test using Phase 2's contract).

## Next Phase Dependency
Phase 5 (Account Manager) needs a stable factory ABI/address to call
against.
