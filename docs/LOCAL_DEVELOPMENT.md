# Local Development

## Required Environment

1. **Local EVM node** (e.g., Anvil) — provides a chain to deploy
   against.
2. **Canonical EntryPoint deployment** on the local node (the
   standard reference EntryPoint contract, not a custom
   reimplementation — see `NON_GOALS.md`).
3. **Smart Account + Factory** deployed to the local node (Phases 2–3).
4. **Local bundler process** compatible with the ERC-4337 JSON-RPC
   surface described in `BUNDLER.md`, configured to point at the local
   EntryPoint.
5. **Demo Paymaster** deployed to the local node (Phase 8), funded/
   staked as required by the local EntryPoint's deposit accounting.
6. **Clerk development environment** — a Clerk dev instance/keys
   configured for the demo app.
7. **Frontend (demo app)** running against the above, per
   `PROJECT_STRUCTURE.md`.

## Required Execution Order

```text
Start local chain
      ↓
Deploy EntryPoint (canonical)
      ↓
Deploy SmartAccountFactory (Phase 3)
      ↓
Deploy Paymaster (Phase 8), fund/stake it
      ↓
Start local bundler, pointed at local EntryPoint
      ↓
Configure SDK (CONFIGURATION.md) with local addresses/RPC URLs
      ↓
Configure Clerk dev environment
      ↓
Run demo app
```

Each step's output (deployed addresses, RPC URLs) feeds
`CONFIGURATION.md`'s local environment configuration.

No shell scripts are specified here; Antigravity implements the
concrete tooling per `PROJECT_STRUCTURE.md`.
