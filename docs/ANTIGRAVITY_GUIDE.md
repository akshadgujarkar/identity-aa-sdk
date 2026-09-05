# Antigravity Guide

This document tells the implementing coding agent (Antigravity) how to
use this documentation package. It has authority over *process*; it
does not override the technical content of other files.

## Source of Truth Table

| Concern | Authoritative File(s) |
|---|---|
| Product requirements | `PRODUCT_VISION.md`, `README.md` |
| Architecture | `ARCHITECTURE.md`, `SDK_ARCHITECTURE.md` |
| Public API | `API_DESIGN.md` |
| Identity model | `IDENTITY_ARCHITECTURE.md` |
| Smart contracts | `SMART_ACCOUNT.md`, `ACCOUNT_FACTORY.md` |
| Transaction handling | `TRANSACTION_ENGINE.md`, `BUNDLER.md`, `GAS_ABSTRACTION.md` |
| Key management | `KEY_MANAGEMENT.md` |
| Security | `SECURITY.md` |
| Errors | `ERROR_MODEL.md` |
| Implementation order | `IMPLEMENTATION_PHASES.md`, `docs/phases/*` |
| Testing | `TESTING.md` |
| Configuration/Deployment | `CONFIGURATION.md`, `DEPLOYMENT.md`, `LOCAL_DEVELOPMENT.md` |
| Scope boundaries | `NON_GOALS.md`, `ROADMAP.md` |

## Implementation Rule

For each phase, Antigravity MUST:

1. Read the relevant `docs/phases/PHASE_NN_*.md` file.
2. Read all files listed in that phase's "Inputs" and "Dependencies."
3. Inspect the existing repository state.
4. Determine what already exists versus what this phase must add.
5. Implement only the current phase's scope.
6. Run the validation/tests required by that phase.
7. Check the phase's acceptance criteria before proceeding.
8. Only then move to the next phase in `IMPLEMENTATION_PHASES.md`'s
   order.

## No Architecture Guessing

If the repository contradicts the specification, Antigravity MUST
stop and identify the contradiction rather than silently inventing a
new architecture.

## No Scope Creep

Antigravity MUST NOT implement `ROADMAP.md` features during an MVP
phase unless the phase document explicitly requires it. `NON_GOALS.md`
is binding.

## Documentation Synchronization

If implementation reveals the architecture is impossible or
incorrect:

```text
Implementation Conflict
        ↓
Document Conflict
        ↓
Update Specification
        ↓
Re-evaluate Dependencies
        ↓
Continue Implementation
```

Antigravity must not silently diverge from the documented
architecture — the specification is updated first, then
implementation continues against the updated spec.
