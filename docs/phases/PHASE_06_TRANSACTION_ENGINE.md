# Phase 06 — Transaction Engine

## Objective
Implement the transaction lifecycle state machine described in
`docs/TRANSACTION_ENGINE.md`, up to and including signing (bundler
integration lands in Phase 7 but a minimal stub/local submission path
may be used here for isolated testing).

## Why This Phase Exists
This is the internal engine behind the public `sendTransaction`/
`execute` API.

## Dependencies
Phase 5 (Account Manager).

## Inputs
`docs/TRANSACTION_ENGINE.md`, `docs/API_DESIGN.md`, ERC-4337
UserOperation field reference (source document 3).

## Files/Modules to Implement
`core/internal/transactionEngine` (intent → UserOperation
construction → nonce resolution → signing), `core/internal/signer`
(signing primitives, shared with Phase 5).

## Interfaces Required
`sendTransaction(account, intent): TransactionHandle` (internal),
public `account.sendTransaction`/`account.execute` per
`docs/API_DESIGN.md`.

## Behavior Required
Full state machine per `docs/TRANSACTION_ENGINE.md` (Building →
Estimating → Signing → Submitting → Pending → Confirmed/Failed/
Dropped), batching support for `execute`.

## Security Requirements
Signing occurs only client-side via Phase 5's signer; no signing
request proceeds without a fully-constructed, estimated operation.

## Testing Requirements
Unit tests per state transition, including forced-failure tests for
each `Failed` trigger listed in `docs/TRANSACTION_ENGINE.md`.

## Acceptance Criteria
State machine transitions match the diagram in
`docs/TRANSACTION_ENGINE.md` exactly, including the `Dropped` terminal
state.

## Definition of Done
A signed UserOperation can be produced end-to-end for a real Account
from Phase 5 (submission to a real bundler is validated in Phase 7).

## Next Phase Dependency
Phase 7 plugs in real bundler estimation/submission/receipt behavior.
