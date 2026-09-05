# Phase 12 — Security Review

## Objective
Formally validate the system against every row of the threat table in
`docs/SECURITY.md`.

## Why This Phase Exists
Security properties (key custody separation, replay protection,
factory salt binding, sponsorship abuse limits) are claimed
throughout the docs; this phase is the checkpoint that verifies each
claim against the actual implementation.

## Dependencies
Phase 11 (test coverage in place to support verification).

## Inputs
`docs/SECURITY.md`, `docs/KEY_MANAGEMENT.md`.

## Files/Modules to Implement
None (review phase); fixes to prior-phase modules as findings require,
tracked back to the owning phase document.

## Interfaces Required
None new.

## Behavior Required
N/A.

## Security Requirements
Every threat in `docs/SECURITY.md`'s table must be re-verified against
the actual codebase, not just the design; any gap must be logged and
routed back to the owning phase (per the Documentation Synchronization
rule in `docs/ANTIGRAVITY_GUIDE.md`) before MVP sign-off.

## Testing Requirements
Re-run Phase 11's security-relevant tests; add any missing ones
surfaced by this review.

## Acceptance Criteria
No open "Residual Risk" in `docs/SECURITY.md` is unexpectedly higher
in the real implementation than documented; any divergence updates
`docs/SECURITY.md` per the synchronization rule.

## Definition of Done
`docs/SECURITY.md` accurately reflects the shipped MVP, with no
undocumented gaps between claimed and actual behavior.
