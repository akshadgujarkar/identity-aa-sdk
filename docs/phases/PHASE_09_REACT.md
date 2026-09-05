# Phase 09 — React Adapter

## Objective
Implement `react/Provider` and hooks (`useSmartAccount`,
`useTransaction`) per `docs/SDK_ARCHITECTURE.md`.

## Why This Phase Exists
The demo application (Phase 10) needs idiomatic React bindings rather
than raw `core` calls scattered through UI code.

## Dependencies
Phase 8 (fully working core SDK, sponsored + unsponsored).

## Inputs
`docs/SDK_ARCHITECTURE.md`, `docs/API_DESIGN.md`.

## Files/Modules to Implement
`react/Provider.tsx`, `react/useSmartAccount.ts`,
`react/useTransaction.ts`.

## Interfaces Required
Hooks wrap `core`'s public client and the configured
`IdentityResolver` (Clerk adapter from Phase 4); no new business logic
introduced here.

## Behavior Required
`useSmartAccount()` exposes account/loading/error state sourced from
`core`; `useTransaction()` exposes a `send` function and
status/receipt/error state mirroring the Transaction Engine's state
machine.

## Security Requirements
None beyond what `core` already enforces; the adapter must not cache
or expose signer key material.

## Testing Requirements
Component/hook tests using a mocked `core` client: loading, success,
and error states render/propagate correctly.

## Acceptance Criteria
A minimal React test harness can call `useSmartAccount()` and
`useTransaction()` and observe correct state transitions.

## Definition of Done
Hooks are consumable by Phase 10's demo without any direct `core`
imports in demo UI components.

## Next Phase Dependency
Phase 10 consumes these hooks directly.
