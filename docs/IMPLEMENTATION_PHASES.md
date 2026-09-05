# Implementation Phases

## Dependency-Ordered Plan

```text
Phase 0  Setup
   ↓
Phase 1  Core Types & Config
   ↓
Phase 2  Smart Account Contract
   ↓
Phase 3  Account Factory Contract
   ↓
Phase 4  Identity Layer (Clerk Adapter)
   ↓
Phase 5  Account Manager
   ↓
Phase 6  Transaction Engine
   ↓
Phase 7  Bundler Client
   ↓
Phase 8  Gas Sponsorship
   ↓
Phase 9  React Adapter
   ↓
Phase 10 Demo Application
   ↓
Phase 11 Testing Hardening
   ↓
Phase 12 Security Review
```

Rationale for ordering: contracts (2, 3) must exist and be deployable
to a local chain before the Account Manager (5) can resolve real
addresses; Identity (4) has no on-chain dependency and can be built in
parallel with 2/3 but must land before 5; the Transaction Engine (6)
depends on both Account Manager (5) and, for gas estimation, on a
working Bundler Client (7) — 6 and 7 are developed together with 7's
minimal read-only estimation path landing first; Gas Sponsorship (8)
is layered on top of a working unsponsored transaction path (6+7);
React (9) and the Demo (10) depend on the full core SDK; Testing (11)
and Security (12) are continuous but formally gated at the end.

Each phase file under `docs/phases/` contains: Objective, Why This
Phase Exists, Dependencies, Inputs, Files/Modules to Implement,
Interfaces Required, Behavior Required, Tests Required, Acceptance
Criteria, Failure Conditions, Expected Result, Next Phase Dependency.

See `docs/ANTIGRAVITY_GUIDE.md` for how these phases must be executed.
