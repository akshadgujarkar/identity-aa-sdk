# Gas Abstraction

## Desired Developer Experience

```text
account.sendTransaction(...)
```

with sponsorship handled entirely by SDK configuration:

```text
Gas Policy → Sponsorship Decision → Paymaster → UserOperation
```

The developer sets sponsorship policy once (`sdk.configure({sponsorship})`
per `API_DESIGN.md`); they never touch paymaster wiring per call.

## Sponsorship Policies

- **Full sponsorship** (MVP default for demo/dev mode): every
  transaction from a configured application is sponsored, subject to
  limits below.
- **Conditional sponsorship** (MVP-capable, policy data supplied by
  the developer): sponsor only calls matching an allowlist of target
  contracts/methods.
- **No sponsorship**: the account pays its own gas (requires the
  account to hold native currency deposited with the EntryPoint) —
  supported but not the demo path.

## Limits

- Per-user rate limit (transactions per time window).
- Per-user or global spend cap (max sponsored gas value per period).
- Both are enforced by the Gas Policy component before a sponsorship
  decision is made, independent of the paymaster contract's own
  checks.

## Allowlists

- Target-contract and/or method-selector allowlists are supported as
  policy configuration; anything outside the allowlist is either
  rejected before submission or falls back to unsponsored, per
  developer configuration (see `CONFIGURATION.md`).

## Abuse Protection

- Rate limits and spend caps (above) plus the paymaster's own deposit/
  stake mechanics (ERC-4337 reputation model) form two independent
  layers of abuse protection: SDK-level policy, and protocol-level
  paymaster staking.

## Development Mode

- A permissive default policy (generous limits, no allowlist) is
  appropriate for local/dev environments, clearly distinguished in
  configuration from production policy (see `CONFIGURATION.md` and
  `LOCAL_DEVELOPMENT.md`).

## Production Mode

- Production sponsorship policy must be explicit (no relying on
  defaults); the SDK MUST fail closed (reject sponsorship, not
  silently fall back to charging the user) if policy configuration is
  missing in a production environment, unless the developer has
  explicitly configured "no sponsorship" as the intended behavior.

## Failure Behavior

- If sponsorship is requested but the policy denies it (limit
  exceeded, not allowlisted), the Transaction Engine surfaces a
  `SponsorshipError` (see `ERROR_MODEL.md`) rather than silently
  falling back to the user paying gas, unless the developer has opted
  into an explicit fallback mode.

## Relationship to ERC-4337 Paymaster

The paymaster contract implements `validatePaymasterUserOp`/`postOp`
per ERC-4337. The SDK's Gas Policy is a layer *above* the paymaster:
it decides whether to attach paymaster data to a given UserOperation
at all. Building a custom paymaster contract is in scope for the MVP
only insofar as required to demonstrate sponsorship (see
`IMPLEMENTATION_PHASES.md`, Phase 8); a production-grade,
general-purpose paymaster is not (see `NON_GOALS.md`).
