# Phase 08 — Gas Sponsorship

## Objective
Implement the Gas Policy and Paymaster Client per
`docs/GAS_ABSTRACTION.md`, layered onto the working transaction path
from Phase 7.

## Why This Phase Exists
Sponsored transactions are the MVP's headline demo behavior (see
`docs/DEMO_APPLICATION.md`) and require policy + paymaster wiring not
present in Phase 6/7.

## Dependencies
Phase 7 (working unsponsored transaction path).

## Inputs
`docs/GAS_ABSTRACTION.md`, ERC-4337 paymaster interface (source
document 3, "Extension: paymasters").

## Files/Modules to Implement
`core/internal/gasPolicy` (rate limit/spend cap/allowlist evaluation),
`core/internal/paymasterClient` (attach paymaster data), a minimal
demo-grade `contracts/Paymaster` implementing
`validatePaymasterUserOp`/`postOp`.

## Interfaces Required
`sdk.configure({ sponsorship })` per `docs/API_DESIGN.md`; internal
`evaluateSponsorship(intent, identity): SponsorshipDecision`.

## Behavior Required
Full/conditional/none sponsorship modes; rate limit and spend cap
enforcement; fail-closed behavior in production configuration per
`docs/GAS_ABSTRACTION.md`; `SponsorshipError` on denial (no silent
fallback unless explicitly configured).

## Security Requirements
Paymaster contract must check `msg.sender == EntryPoint` on both
`validatePaymasterUserOp` and `postOp` per ERC-4337 requirement; SDK
policy checks happen before paymaster data is attached, not only
on-chain.

## Testing Requirements
Unit tests for policy evaluation (allow/deny paths, limit exceeded);
integration test: sponsored transaction confirms with the demo
paymaster on the local chain; denied sponsorship surfaces
`SponsorshipError`.

## Acceptance Criteria
The "Sponsored Transaction" sequence in `docs/DATA_FLOW.md` is
reproducible end-to-end.

## Definition of Done
A transaction with zero account balance confirms on-chain, gas paid
by the demo paymaster.

## Next Phase Dependency
Phase 9/10 build UI on top of a fully working sponsored transaction
path.
