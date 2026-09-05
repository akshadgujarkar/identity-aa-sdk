# Phase 01 — Core Types & Configuration

## Objective
Define the shared types and configuration surface used by every later
module: `AppIdentity`, `AccountKey`, `Account`, `TransactionIntent`,
`Receipt`, SDK error types (per `docs/ERROR_MODEL.md`), and the SDK
configuration shape (per `docs/CONFIGURATION.md`).

## Why This Phase Exists
Every other module depends on these types. Defining them first
prevents divergent, incompatible shapes emerging independently in
later phases.

## Dependencies
Phase 0.

## Inputs
`docs/API_DESIGN.md`, `docs/IDENTITY_ARCHITECTURE.md`,
`docs/ERROR_MODEL.md`, `docs/CONFIGURATION.md`.

## Files/Modules to Implement
`core/types` (all shared types), `core/errors` (error class hierarchy
per category), `core/config` (configuration parsing/validation).

## Interfaces Required
`IdentityResolver` interface (per `docs/SDK_ARCHITECTURE.md`):
`resolve(): Promise<AppIdentity>`.

## Behavior Required
- Config validation rejects incomplete production configuration per
  `docs/CONFIGURATION.md` fail-closed rules.
- Error classes carry `category`, `code`, `message`, `retryable`,
  optional `debug`/`causeCode` per `docs/ERROR_MODEL.md`.

## Tests Required
Unit tests: type shape validation, config validation (valid/invalid
cases), error class construction and category tagging.

## Acceptance Criteria
- All types compile and are exported from `core`'s internal module
  tree (not yet the public entry point).
- Config validation has test coverage for at least one failure per
  required field.

## Failure Conditions
Ambiguous or missing fields in `AccountKey`/`AppIdentity` that later
phases would have to guess at.

## Expected Result
A typed foundation with no business logic yet.

## Next Phase Dependency
Phase 2 needs the smart-account-related types (owner key shape) to be
final enough not to require contract rework.
