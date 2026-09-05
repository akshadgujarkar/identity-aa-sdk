# Configuration

## Configuration Categories

| Category | Examples | Exposure |
|---|---|---|
| Public configuration | chain ID, RPC URL, bundler URL, factory address, EntryPoint address, Clerk publishable key | Safe in frontend config |
| Secret configuration | Clerk secret key, paymaster funding/admin credentials | Backend-only, never shipped to frontend |
| Network configuration | Per-chain RPC/bundler endpoints | Keyed by chain ID |
| Clerk configuration | Publishable key (frontend), secret key (backend session verification) | Split per above |
| RPC configuration | Chain RPC URL, request timeout | Public |
| Bundler configuration | Bundler RPC URL, submission timeout, receipt-poll interval/timeout | Public |
| Paymaster configuration | Paymaster contract address (public), sponsorship policy (rate limits, spend caps, allowlists — see `GAS_ABSTRACTION.md`) | Address is public; policy limits may be backend-enforced |
| Contract addresses | EntryPoint, Factory, Paymaster, per chain | Public |

## Rules

- No secret configuration value is ever placed in frontend-shipped
  code or environment variables that end up in a browser bundle.
- Production environments MUST supply an explicit sponsorship policy;
  the SDK fails closed (see `GAS_ABSTRACTION.md`) if it is missing.
- Configuration is keyed per chain ID so multi-chain support (future,
  see `ROADMAP.md`) does not require reshaping the config type.

## No Credentials Here

This document defines the *shape* of configuration only. No actual
keys, secrets, or deployed addresses are included in this
documentation package.
