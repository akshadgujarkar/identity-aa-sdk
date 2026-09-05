# Phase 10 — Demo Application

## Objective
Build the demo application specified in `docs/DEMO_APPLICATION.md`
using only the public SDK surface (via the React adapter from Phase
9), proving the end-to-end thesis.

## Why This Phase Exists
This is the artifact that proves the SDK — not a raw ERC-4337
integration — is what powers the experience.

## Dependencies
Phase 9.

## Inputs
`docs/DEMO_APPLICATION.md`, `docs/USER_EXPERIENCE.md`,
`docs/QUICK_START.md`.

## Files/Modules to Implement
`demo/` application implementing the flow specified in
`docs/DEMO_APPLICATION.md`.

## Interfaces Required
None new; consumes `react` package only.

## Behavior Required
Clerk login → account auto-resolved and shown → one user action →
sponsored transaction → confirmation state, exactly matching
`docs/USER_EXPERIENCE.md`'s "what the user should/shouldn't see"
rules.

## Security Requirements
Demo must not bypass the SDK to talk to the bundler/EntryPoint
directly (this is the thing Phase 10 exists to prove does not need to
happen).

## Testing Requirements
End-to-end test: login → account shown → action → confirmed, on the
local chain/bundler/paymaster from prior phases.

## Acceptance Criteria
Matches every "What the user sees" / "should NOT see" line in
`docs/USER_EXPERIENCE.md`; matches `docs/DEMO_APPLICATION.md`'s proof
checklist.

## Definition of Done
A person unfamiliar with the codebase can complete the full flow
without touching a wallet extension or seeing ERC-4337 vocabulary.

## Next Phase Dependency
Phase 11 formalizes test coverage across everything built so far.
