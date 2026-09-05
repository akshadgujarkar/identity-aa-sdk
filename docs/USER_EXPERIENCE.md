# User Experience

## Ideal Journey

```text
Visit Application
      ↓
Login with Clerk
      ↓
Account automatically available
      ↓
Perform application action
      ↓
Transaction submitted
      ↓
Transaction confirmed
```

## What the User Sees

- A normal Web2 login (Google/email/etc., via Clerk).
- Their account "already there" — an address may be shown in a
  profile/dashboard area, but is not something they had to create.
- Application actions (e.g., "Like," "Mint," "Submit") that just work
  when clicked.
- A lightweight confirmation state (e.g., "Confirmed ✓") after an
  action, not a wallet-style transaction approval popup, when the
  transaction is sponsored and the account/session model doesn't
  require per-transaction user approval.

## What the User Should NOT Have to See

- MetaMask or any wallet-extension install prompt.
- A seed phrase, at any point.
- A request to acquire native gas tokens before their first action.
- ERC-4337 vocabulary (UserOperation, bundler, paymaster, EntryPoint)
  anywhere in the UI.
- A raw blockchain transaction hash as the primary success indicator
  (it may be available in an "advanced details" affordance, not as
  the headline).

## Avoiding "Traditional Wallet" Feel

- The account is presented as a property of the user's profile within
  the application, not as a separate "wallet" surface to manage.
- Recovery limitations (see `KEY_MANAGEMENT.md`: no recovery in MVP)
  should be disclosed in plain language if/when relevant (e.g., "this
  account lives on this device"), not hidden, but without adopting
  wallet-app UI patterns (seed phrase backup screens, etc.) that would
  reintroduce the friction this product exists to remove.
