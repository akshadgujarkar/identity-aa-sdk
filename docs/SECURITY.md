# Security

## Security Assumptions

- Clerk correctly authenticates users; the SDK trusts a verified Clerk
  session as proof of identity, nothing more.
- The device's WebCrypto implementation correctly enforces
  non-extractability of the signing key.
- The EntryPoint, bundler, and (if used) paymaster are the audited,
  canonical/standard implementations, not custom-built by this
  project (see `NON_GOALS.md`).

## Threat Model

| Threat | Impact | Likelihood | Mitigation | Residual Risk |
|---|---|---|---|---|
| Compromised Clerk session (stolen session token) | Attacker can request account resolution and, if device also compromised, sign transactions | Medium | Short session lifetimes, standard Clerk session security; SDK re-verifies session before signing UI is shown | Session hijack still enables read/UX access even if signing key is on a different device |
| Compromised browser/device | Full signing capability for that device's key | Medium | Non-extractable key storage limits exfiltration to "the malware can request signatures," not "the malware can export the key" | Malware co-resident with the app can still request arbitrary signatures |
| Malicious frontend (supply-chain) | Could trick user into signing malicious UserOperations | Low–Medium | Standard frontend supply-chain hygiene (outside SDK); SDK surfaces transaction intent clearly for confirmation UIs to render | Ultimately depends on the integrating application's UI honesty |
| Malicious backend | Could tamper with sponsorship decisions, misreport account state | Low | Backend never holds signing key; signing always client-side | Backend can still deny-of-service sponsorship or misreport, bounded impact |
| Stolen signing key export | Full account takeover | Low (key is non-extractable) | WebCrypto non-extractable keys | Device-level exploits capable of bypassing browser crypto sandboxing |
| Replay attacks | Reuse of a signed UserOperation | Low | ERC-4337 `userOpHash` binds chainId + EntryPoint address; nonce enforced by EntryPoint | None expected if EntryPoint invariants hold |
| Signature manipulation | Forged approval | Low | Standard ECDSA verification in `validateUserOp` | Depends on correct account contract implementation |
| Operation tampering in mempool | Bundler/relay modifies operation before inclusion | Low | Signature covers all operation fields via `userOpHash` | None expected |
| Factory attacks (arbitrary salt/address hijack) | Attacker deploys account at unexpected address or hijacks pre-funded counterfactual address | Low | Salt tied to identity + owner key material, not attacker-controlled (see `ACCOUNT_FACTORY.md`) | None expected if factory spec is followed |
| Initialization attacks (re-init) | Attacker re-initializes an already-deployed account | Low | Single-init guard, factory-origin-only deployment (see `SMART_ACCOUNT.md`) | None expected |
| Nonce attacks (replay via reused nonce) | Double-execution | Low | EntryPoint-enforced sequential nonce | None expected |
| Bundler abuse (spam/DoS) | Degraded service, dropped operations | Medium | Standard bundler-side reputation/staking (ERC-4337); not reimplemented here | Outside SDK's direct control — production bundler choice matters |
| Paymaster abuse | Sponsorship budget drained | Medium | Gas Policy rate limits + spend caps (see `GAS_ABSTRACTION.md`) plus paymaster staking | Requires correctly configured policy in production |
| Malicious contract calls (developer-supplied `to`/`data`) | Arbitrary on-chain effect | N/A (by design) | SDK does not restrict call targets; this is application responsibility | Explicit non-goal for SDK to police |
| Phishing (user tricked outside the app) | Account compromise via social engineering | Medium | Outside SDK scope; standard user-education guidance | Not mitigable at SDK layer |
| Denial of service (bundler/backend unavailability) | Transactions cannot be submitted | Medium | Timeouts + retry policy (see `TRANSACTION_ENGINE.md`) | Availability depends on chosen infra providers |
| Upgrade risks (future account upgradeability) | Storage collision, bricked accounts | Low (MVP is non-upgradeable) | Non-upgradeable MVP; future upgrade path requires collision-resistant storage layout (see `SMART_ACCOUNT.md`) | Deferred until upgradeability is actually introduced |

## Explicit Security Non-Assumptions

- The SDK does not assume the integrating application's frontend code
  is free of vulnerabilities.
- The SDK does not assume the user's device is malware-free.
- The SDK does not evaluate the safety of arbitrary contract calls a
  developer chooses to send.

## Cross-References

- Trust boundaries diagram: `ARCHITECTURE.md`.
- Key custody detail: `KEY_MANAGEMENT.md`.
- Sponsorship abuse controls: `GAS_ABSTRACTION.md`.
- Smart account validation invariants: `SMART_ACCOUNT.md`.
