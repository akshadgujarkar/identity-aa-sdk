# Deployment

## Environments

```text
Local
  ↓
Testnet
  ↓
Production
```

## Deployment Dependencies (per environment)

1. EntryPoint available (canonical deployment; reused on public
   testnets/mainnet where already deployed, freshly deployed only for
   `Local`).
2. SmartAccountFactory deployed, pointed at the correct EntryPoint.
3. Paymaster deployed and funded/staked, pointed at the correct
   EntryPoint (only required if sponsorship is enabled for that
   environment).
4. Bundler endpoint available (self-run for `Local`, hosted/managed
   for `Testnet`/`Production`).
5. Clerk environment configured (dev instance for `Local`/`Testnet`,
   production instance for `Production`).
6. SDK configuration (`CONFIGURATION.md`) populated with the above
   addresses/endpoints for that environment.

## Contract Deployment Order

```text
EntryPoint (or reuse existing)
     ↓
SmartAccountFactory
     ↓
Paymaster (if sponsorship enabled)
```

The Factory must be deployed with a reference to the already-deployed
EntryPoint; the Paymaster likewise.

## Configuration Propagation

Deployed addresses flow into `CONFIGURATION.md`'s per-environment
config, consumed by the SDK at initialization. No address is
hard-coded inside `core`.

## Environment Separation

- `Local`, `Testnet`, and `Production` configurations MUST be
  fully distinct (different Clerk instances, different contract
  addresses, different bundler endpoints) — no environment silently
  falls back to another's configuration.

## Security Requirements

- Production sponsorship policy must be explicitly set (see
  `GAS_ABSTRACTION.md` fail-closed rule).
- Secret configuration (Clerk secret key, paymaster admin credentials)
  is deployed only to backend infrastructure, never to the frontend
  build output.

No deployment scripts are specified here; Antigravity implements the
concrete tooling.
