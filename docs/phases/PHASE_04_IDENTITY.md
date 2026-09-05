# Phase 04 — Identity Layer (Clerk Adapter)

## Objective
Implement the `IdentityResolver` interface against Clerk, producing
`AppIdentity` values per `docs/IDENTITY_ARCHITECTURE.md`.

## Why This Phase Exists
The Account Manager (Phase 5) needs a real identity source; this
phase can be built in parallel with Phases 2/3 since it has no
on-chain dependency.

## Dependencies
Phase 1 (types).

## Inputs
`docs/IDENTITY_ARCHITECTURE.md`, `docs/SDK_ARCHITECTURE.md`
(`IdentityResolver` contract).

## Files/Modules to Implement
`clerk/ClerkIdentityResolver` implementing `IdentityResolver`.

## Interfaces Required
`IdentityResolver.resolve(): Promise<AppIdentity>`.

## Behavior Required
Resolves the current Clerk session into `{provider: "clerk",
subjectId, namespace}`; throws `IdentityError` (per
`docs/ERROR_MODEL.md`) when no session is present.

## Security Requirements
Never persists or forwards raw Clerk session tokens beyond what
Clerk's own SDK requires; never derives or touches signing key
material (identity and signing remain separate per
`docs/IDENTITY_ARCHITECTURE.md`).

## Testing Requirements
Unit tests with a mocked Clerk session: authenticated → resolves;
unauthenticated → `IdentityError`.

## Acceptance Criteria
`core`'s `IdentityResolver` interface is satisfied without `core`
importing any Clerk types.

## Definition of Done
`ClerkIdentityResolver` resolves a real local Clerk dev session to an
`AppIdentity`.

## Next Phase Dependency
Phase 5 consumes this resolver through the `IdentityResolver`
interface only.
