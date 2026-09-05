# Phase 07 — Bundler Client

## Objective
Implement the Bundler Client per `docs/BUNDLER.md`, replacing any
Phase 6 stub with real bundler RPC integration.

## Why This Phase Exists
Real gas estimation, submission, and receipt polling require a real
bundler; the Transaction Engine's `Estimating`/`Submitting`/`Pending`
states are not truly testable without it.

## Dependencies
Phase 6 (engine skeleton), Phase 0 (local chain/bundler environment).

## Inputs
`docs/BUNDLER.md`, `docs/CONFIGURATION.md`, ERC-4337 JSON-RPC section
(source document 3).

## Files/Modules to Implement
`core/internal/bundlerClient` (estimate, submit, poll receipt, nonce
query, counterfactual address query).

## Interfaces Required
Internal bundler client interface consumed by
`core/internal/transactionEngine`.

## Behavior Required
All behavior in `docs/BUNDLER.md`: RPC abstraction, response
translation into internal types, receipt polling with configurable
interval/timeout, bounded retry for transient network failures only.

## Security Requirements
No raw bundler error payload crosses into the public API unmapped
(hand off to Error Translator, formalized fully in Phase 6/8
integration, but this phase must not leak raw errors either).

## Testing Requirements
Integration tests against the local bundler (Phase 0 environment):
successful estimate/submit/receipt cycle; rejected UserOperation
surfaces a translatable error; dropped operation is detected.

## Acceptance Criteria
The "Transaction (Unsponsored)" sequence in `docs/DATA_FLOW.md` is
reproducible end-to-end on the local chain.

## Definition of Done
An unsponsored transaction sent via `sendTransaction` confirms
on-chain using a real local bundler + EntryPoint + Phase 2/3
contracts.

## Next Phase Dependency
Phase 8 adds sponsorship on top of this working unsponsored path.
