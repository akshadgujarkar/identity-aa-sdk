# Developer Experience

## Ideal Journey

```text
Install
  ↓
Configure Clerk
  ↓
Initialize SDK
  ↓
Get Account
  ↓
Send Transaction
  ↓
Receive Receipt
```

A Web2 developer should be able to complete this journey without
reading anything about ERC-4337, UserOperations, bundlers, or
paymasters. See `QUICK_START.md` for the minimal concrete version of
this journey.

## Minimum Integration Surface

1. Wrap the app with the existing Clerk provider (already required by
   any Clerk-based app — no new concept here).
2. Construct the SDK client with a chain + (optionally) sponsorship
   config.
3. Call `sdk.getAccount()` to get the current user's account.
4. Call `account.sendTransaction(...)` for any on-chain action.
5. Await the returned handle's receipt.

That is the entire required surface. Everything else in `API_DESIGN.md`
is optional/advanced.

## What Good Looks Like

- No import of an ERC-4337 types package required for basic usage.
- No bundler URL required to appear in application code paths beyond
  one configuration block (see `CONFIGURATION.md`).
- Errors are catchable, typed, and readable without ERC-4337
  knowledge (see `ERROR_MODEL.md`).

## What Bad Looks Like (explicitly avoided)

- Requiring the developer to construct a `UserOperation` object.
- Requiring the developer to manage nonce keys.
- Requiring the developer to choose a paymaster contract address
  per call.
- Surfacing raw `AA##` revert codes as the primary error message.
