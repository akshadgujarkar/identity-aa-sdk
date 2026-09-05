# Project Structure

## Chosen Layout

```text
identity-aa-sdk/
├── packages/
│   ├── core/            # framework-independent SDK logic
│   ├── clerk/            # Clerk IdentityResolver adapter
│   └── react/             # React hooks/provider
├── contracts/
│   ├── SmartAccount.sol
│   ├── SmartAccountFactory.sol
│   └── Paymaster.sol
├── demo/                  # example application (Phase 10)
├── tests/                 # cross-package integration/e2e tests
└── docs/                  # this documentation package
```

## Rationale

`apps/` + `packages/` + `contracts/` is not used verbatim; instead
`demo/` stands alone as the single example app (no need for a
plural `apps/` directory at MVP scope), and `packages/` holds the
publishable SDK surface (`core`, `clerk`, `react`) mirroring the
module boundaries in `SDK_ARCHITECTURE.md`. `contracts/` is kept
top-level (not nested under `packages/`) because it is consumed as
build artifacts (ABI + addresses) rather than as a source dependency
of `core`.

## Directory Responsibilities

| Directory | Responsibility |
|---|---|
| `packages/core` | Types, config, Account Manager, Transaction Engine, Bundler Client, Gas Policy, Error Translator, public API entry point |
| `packages/clerk` | `IdentityResolver` implementation against Clerk |
| `packages/react` | `Provider`, `useSmartAccount`, `useTransaction` |
| `contracts` | Smart Account, Factory, Paymaster (Solidity) |
| `demo` | End-to-end proof application (Phase 10) |
| `tests` | Integration/e2e tests spanning multiple packages (unit tests live alongside their package) |
| `docs` | This specification package |
