# Phase 02 — Smart Account Contract

## Objective
Implement the ERC-4337 smart account contract per
`docs/SMART_ACCOUNT.md`.

## Why This Phase Exists
The Account Factory (Phase 3) and every later on-chain interaction
depend on a working account implementation.

## Dependencies
Phase 1 (owner key type shape).

## Inputs
`docs/SMART_ACCOUNT.md`, ERC-4337 `IAccount` interface (source
document 3, "Smart Contract Account Interface").

## Files/Modules to Implement
`contracts/SmartAccount` (single-owner ERC-4337 account),
corresponding interface files.

## Interfaces Required
`IAccount.validateUserOp`; single-call and batched `execute`, gated to
`msg.sender == EntryPoint`.

## Behavior Required
All behavior specified in `docs/SMART_ACCOUNT.md`: EntryPoint-only
gating, non-reverting signature-mismatch handling
(`SIG_VALIDATION_FAILED`), single initialization, classic sequential
nonce (key 0), no upgradeability in MVP.

## Security Requirements
Per `docs/SMART_ACCOUNT.md` Security Boundaries; no unrelated storage
in the initialization path (see recovery-roadmap compatibility note).

## Testing Requirements
Contract unit tests: validation rejects non-EntryPoint callers;
signature verification accepts valid / rejects invalid signatures
without reverting; execute only callable post-validation; replay
protection via nonce; re-initialization is rejected.

## Acceptance Criteria
All tests above pass against a local EntryPoint deployment (Phase 0
local chain, canonical/standard EntryPoint contract — not custom-
built, per `docs/NON_GOALS.md`).

## Definition of Done
Contract deployed and callable on the local chain via a hand-built
UserOperation (manual test, not yet through the SDK).

## Next Phase Dependency
Phase 3's factory needs this contract's init call signature finalized.
