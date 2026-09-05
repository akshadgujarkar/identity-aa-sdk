# SDK Architecture

## Repository Shape

Monorepo, TypeScript, framework-independent core with thin adapters.
Rationale: identity adapters (Clerk today, others later) and UI
adapters (React today, others later) must be swappable without
touching account/transaction logic. See `docs/PROJECT_STRUCTURE.md`
for the directory layout and `docs/DESIGN_DECISIONS.md` for the
monorepo/TypeScript decision record.

## Modules

| Module | Depends on | Owns | Public? |
|---|---|---|---|
| `core` | nothing (chain client only) | Account Manager, Transaction Engine, Bundler Client, Gas Policy, Error Translator, types | Public API surface lives here |
| `clerk` (identity adapter) | `core` (interfaces only) | Clerk → identity resolution | Public: adapter constructor only |
| `react` | `core`, one identity adapter | Hooks/provider bindings | Public: hooks only |
| `contracts` | none (Solidity) | Smart Account, Factory, Paymaster interfaces | Not a runtime dependency of `core`'s public API |
| `demo` | `core`, `clerk`, `react` | Example application | N/A |

## Interfaces Between Modules

- `core` defines an `IdentityResolver` interface (`resolve(): Promise<AppIdentity>`).
  This is the **only** contract an identity adapter must satisfy.
- `clerk` implements `IdentityResolver` against the Clerk SDK/session.
  `core` never imports Clerk types directly.
- `react` consumes `core`'s public client plus one `IdentityResolver`
  implementation; it does not add business logic.
- `contracts` is consumed only at deployment/configuration time (ABI +
  deployed addresses), never as a source dependency of `core`'s
  runtime logic.

## Data Ownership

- `core` owns account state, transaction state, and configuration.
- `clerk` owns nothing beyond translating a Clerk session into an
  `AppIdentity` value object; it holds no persistent state of its own.
- `react` owns only UI-local state (loading/error flags derived from
  `core`).

## Lifecycle

```text
SDK construction (config + identity resolver)
        ↓
Identity resolution (per session)
        ↓
Account resolution (per identity, cached)
        ↓
Transaction submission (per call)
```

The SDK instance is long-lived per session; account resolution is
cached per identity; transaction state is per-call.

## Public/Private Boundary Rule

Anything in `core/internal/**` is never re-exported from the package
entry point. The entry point exports only: SDK constructor, `account`,
`transaction`/`receipt` types, `message` methods, `sponsorship` config
type, and the SDK error types. This boundary is what prevents
ERC-4337 vocabulary from leaking into the public API — see the Public
API Abstraction Test in `docs/DESIGN_DECISIONS.md`.
