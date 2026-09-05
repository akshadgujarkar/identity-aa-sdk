# Phase 05 — Account Manager

## Objective
Implement account resolution: identity → `AccountKey` → counterfactual
address → `Account` object, per `docs/IDENTITY_ARCHITECTURE.md` and
`docs/ACCOUNT_FACTORY.md`.

## Why This Phase Exists
This is the component behind the public `sdk.getAccount()` API and is
required before any transaction can be constructed.

## Dependencies
Phases 3 (factory deployed) and 4 (identity resolver).

## Inputs
`docs/IDENTITY_ARCHITECTURE.md`, `docs/ACCOUNT_FACTORY.md`,
`docs/API_DESIGN.md` (`sdk.getAccount()` contract).

## Files/Modules to Implement
`core/internal/accountManager` (identity → `AccountKey` derivation,
factory view-call integration, local signer lookup/creation via
`core/internal/signer`, deployment-state check).

## Interfaces Required
`getAccount(identity): Promise<Account>` (internal); `Account` public
shape per `docs/API_DESIGN.md`.

## Behavior Required
Deterministic `AccountKey` derivation; counterfactual address query;
local signer creation on first resolution per
`docs/KEY_MANAGEMENT.md`; caching per identity for the SDK instance
lifetime.

## Security Requirements
Signer key generation must use non-extractable WebCrypto keys per
`docs/KEY_MANAGEMENT.md`; no key material logged or returned from this
module.

## Testing Requirements
Unit tests: first-time resolution generates a signer and returns
`isDeployed:false`; returning-user resolution reuses the existing
signer; deterministic address is stable across repeated calls for the
same identity.

## Acceptance Criteria
Matches the "Account Resolution" sequence diagrams in
`docs/DATA_FLOW.md`.

## Definition of Done
`sdk.getAccount()` returns a real, correctly-derived address for a
real local Clerk identity against the Phase 3 factory.

## Next Phase Dependency
Phase 6 (Transaction Engine) consumes `Account` objects from this
module.
