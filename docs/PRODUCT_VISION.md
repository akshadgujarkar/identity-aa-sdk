# Product Vision

## Problem Statement

Two distinct, unsolved-together problems block mainstream on-chain
adoption:

1. **End-user onboarding friction.** Wallet installation, seed-phrase
   custody, and gas acquisition are unacceptable UX costs for a Web2
   audience.
2. **Developer integration friction.** Account abstraction (ERC-4337)
   is powerful but exposes deep infrastructure concepts (UserOperations,
   EntryPoint, bundlers, paymasters, nonce keys) that have nothing to
   do with the application logic a developer is actually trying to
   ship.

Existing account-abstraction SDKs solve the second problem partially,
but still speak in ERC-4337-shaped vocabulary and still treat wallet
creation as a separate, explicit user step. None of them start from
"the user is already authenticated in your app" as the root of the
account model.

## Target Users

- **Application developers** already using (or willing to use) Clerk
  for authentication, who want to add on-chain actions to an existing
  Web2-shaped product (social, ticketing, gaming, marketplace, loyalty).
- **End users** of those applications, who have no prior Web3
  experience and should not need to acquire any.

## Developer Pain

- Must learn ERC-4337 vocabulary to ship anything.
- Must operate or integrate a bundler and (optionally) a paymaster.
- Must design their own mapping from "my user" to "their on-chain
  account," including deployment timing and multi-device access.
- Must build their own error-handling and retry model on top of raw
  JSON-RPC bundler errors.

## End-User Pain

- Wallet installation is a hard onboarding wall.
- Seed-phrase custody is a comprehension and liability problem.
- Needing to acquire gas tokens before taking any action kills
  activation.
- Multi-device access to "their" wallet is confusing or unsupported.

## Product Thesis

> An application's users already have an identity: their authenticated
> session. The correct root of a smart account is that identity, not
> a browser extension. If the SDK owns the identity → account binding,
> it can hide every ERC-4337 concept behind an API shaped like the
> identity layer developers already use.

## Why This, Instead of Directly Integrating an Existing AA SDK?

Directly integrating an ERC-4337 SDK still leaves the developer to:

- decide how a user maps to an account,
- decide when/how the account is created,
- decide how multi-device access works,
- translate low-level bundler/paymaster errors into UX,
- and expose ERC-4337 vocabulary somewhere in their app.

This product's differentiation is not "a nicer client library over the
same primitives." It is that **identity is the account's root of
truth**, so account resolution, lifecycle, and multi-device questions
are solved once, centrally, by the SDK — instead of being redesigned
by every developer who adopts account abstraction. The value compounds
across:

- **Identity** — the account address is derivable from something the
  developer already has (a Clerk user).
- **Application-native accounts** — the account is a property of the
  user's session, not a browser-local artifact.
- **Account lifecycle** — creation, deployment timing, and (in future
  phases) multi-device and recovery are handled by the SDK's identity
  model rather than left to each integrator.
- **Transaction abstraction** — one `sendTransaction` call instead of
  UserOperation construction.
- **Gas abstraction** — sponsorship is a configuration flag, not an
  integration project.
- **Developer experience** — the entire integration surface is a
  handful of identity-shaped methods.

## Value Proposition

- Developers: ship an on-chain action in the time it takes to add an
  SDK and call one method, with no ERC-4337 reading required.
- Users: never see a wallet, seed phrase, or gas prompt.

## Competitive Positioning

Generic AA SDKs compete on "easier ERC-4337." This product competes on
"you never think about ERC-4337 at all, because your identity layer
already is the account layer."

## MVP

See `docs/NON_GOALS.md` and `docs/IMPLEMENTATION_PHASES.md`. In short:
Clerk auth → deterministic smart account → one sponsored transaction
→ receipt, all through the SDK.

## Non-Goals (summary)

No custom bundler, no custom EntryPoint, no MPC, no multi-chain, no
full wallet UI, no non-Clerk identity providers in the MVP. Full list
in `docs/NON_GOALS.md`.

## Future Roadmap (summary)

Passkey/WebAuthn signing, multi-device accounts, session keys,
recovery, spending limits, additional identity providers, EIP-7702.
Full list in `docs/ROADMAP.md`.
