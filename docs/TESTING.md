# Testing Architecture

No test source is provided here — this defines what must be tested.

## Unit
- Identity resolution (Clerk session present/absent, malformed).
- Account resolution (`AccountKey` derivation determinism, caching).
- Transaction construction (intent → UserOperation field mapping).
- Nonce handling (sequential nonce correctness).
- Gas estimation (mapping bundler response into engine fields).
- Signing (correct hash signed; non-extractable key never exposed).
- Error translation (every `ERROR_MODEL.md` category has at least one
  triggering unit test).

## Contract
- Validation: EntryPoint-only gating; correct accept/reject on valid/
  invalid signatures without reverting on mismatch.
- Execution: only reachable after successful validation; batch
  execution behavior.
- Authorization: single-owner enforcement; no re-initialization.
- Replay protection: reused nonce is rejected.
- Factory: deterministic addresses; idempotent deploy; salt
  uniqueness per `AccountKey`.

## Integration
```text
Clerk → SDK → Smart Account → Bundler → Blockchain
```
Exercised as: authenticate → `getAccount()` → `sendTransaction()` →
confirmed receipt, against the local chain/bundler from
`LOCAL_DEVELOPMENT.md`, both unsponsored (Phase 7) and sponsored
(Phase 8) paths.

## End-to-End
Entire application flow through the demo app (`DEMO_APPLICATION.md`):
login → account shown → action → confirmation, verifying the user
never encounters a wallet-install prompt or ERC-4337 vocabulary.

## Acceptance Criteria
- Every phase's "Acceptance Criteria" (see `docs/phases/`) is backed
  by an automated test by the end of Phase 11.
- Every row of the `SECURITY.md` threat table has a corresponding
  test where technically feasible, verified in Phase 12.
