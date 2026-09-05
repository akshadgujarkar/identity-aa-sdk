# Phase 11 — Testing Hardening

## Objective
Fill test coverage gaps per `docs/TESTING.md` across unit, contract,
integration, and end-to-end layers, beyond the per-phase tests already
required.

## Why This Phase Exists
Individual phases require local tests sufficient to prove that phase;
this phase ensures cross-phase and regression coverage exists before
declaring the MVP done.

## Dependencies
Phase 10 (all functional pieces exist).

## Inputs
`docs/TESTING.md`.

## Files/Modules to Implement
Additional test suites only — no new product modules.

## Interfaces Required
None new.

## Behavior Required
N/A (testing phase).

## Security Requirements
Security-relevant test cases from `docs/SECURITY.md`'s threat table
must have at least one corresponding automated test where feasible
(e.g., replay protection, non-EntryPoint caller rejection,
re-initialization rejection).

## Testing Requirements
Full matrix from `docs/TESTING.md`: unit (identity resolution, account
resolution, transaction construction, nonce handling, gas estimation,
signing, error translation), contract (validation, execution,
authorization, replay protection, factory determinism), integration
(Clerk → SDK → Smart Account → Bundler → Blockchain), end-to-end
(full demo flow).

## Acceptance Criteria
Every acceptance criterion listed in Phases 0–10 has a corresponding
automated test, not just a manual verification.

## Failure Conditions
Any phase's acceptance criteria are only verifiable manually.

## Expected Result
A test suite that can catch a regression in any phase without manual
re-verification.

## Next Phase Dependency
Phase 12 relies on this coverage to validate security fixes don't
regress functionality.
