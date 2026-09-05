# Demo Application

## What It Must Prove

- Clerk authentication is sufficient to get a working on-chain
  account — no separate wallet-connection step.
- The account address is available immediately (even before
  deployment).
- A single user action results in a real on-chain transaction.
- That transaction is gas-sponsored (the user needs no native gas).
- The user sees a clear success/failure state without ERC-4337
  vocabulary.
- Everything above goes through the SDK's public API
  (`API_DESIGN.md`), not direct ERC-4337 library calls from the demo
  app.

## Suggested Shape

A minimal "Web3 Guestbook": Clerk login → account address shown →
user types a message → "Submit" → sponsored transaction writes the
message on-chain → "Confirmed ✓" state shown, matching
`USER_EXPERIENCE.md`.

## Proof Checklist (Definition of Done for Phase 10)

- [ ] No wallet-extension install prompt appears anywhere in the flow.
- [ ] No seed phrase is shown or requested.
- [ ] The account address is visible before any transaction is sent.
- [ ] The submitted transaction is confirmed on-chain (verifiable via
      the local chain/explorer), with gas paid by the demo paymaster.
- [ ] The demo app's code imports only the `react`/`core` SDK
      packages for account/transaction logic — no direct bundler or
      EntryPoint calls.

This document specifies what the demo must prove, not its
implementation.
