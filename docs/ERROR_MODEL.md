# Error Model

## Goal

Every error a developer can catch is an SDK error type. No raw
bundler JSON-RPC error, contract revert string, or ERC-4337 `AA##`
code reaches the public API unmapped.

## Error Categories

| Category | Represents | Example Trigger |
|---|---|---|
| `IdentityError` | No/invalid authenticated identity | Clerk session missing/expired when `getAccount()` is called |
| `AccountError` | Account resolution/derivation failure | Counterfactual address computation fails |
| `SigningError` | Local signing failure | WebCrypto unavailable, key access denied |
| `TransactionError` | Generic transaction lifecycle failure not covered by a more specific category | Timeout, dropped operation |
| `GasError` | Gas estimation failure | Estimation call reverts or returns implausible values |
| `SponsorshipError` | Sponsorship denied or paymaster failure | Rate limit exceeded, paymaster deposit insufficient |
| `BundlerError` | Bundler-level rejection or unavailability | Bundler RPC unreachable, operation rejected pre-mempool |
| `NetworkError` | RPC/network connectivity failure | Chain RPC unreachable |
| `ContractExecutionError` | On-chain execution failure (validated + submitted but reverted) | `execute()` calldata reverts on-chain |

## Error Structure

Every SDK error carries:

- `category` (one of the above),
- `code` (stable machine-readable string, unique within category),
- `message` (developer-facing, human-readable, no ERC-4337 jargon by
  default),
- `debug` (optional, richer detail incl. underlying bundler/contract
  error, intended for logging, not for end-user display),
- `retryable` (boolean),
- `causeCode` (optional, the underlying `AA##` or bundler code, for
  advanced debugging only — see `ERC4337_INTERNAL_MAPPING.md`).

## Retryability & Recovery Strategy

| Category | Typically retryable? | Suggested recovery |
|---|---|---|
| `IdentityError` | No | Re-authenticate |
| `AccountError` | Sometimes | Retry resolution; escalate if persistent |
| `SigningError` | No | User must retry signing action; check device support |
| `TransactionError` | Sometimes | Retry submission per policy in `TRANSACTION_ENGINE.md` |
| `GasError` | Sometimes | Retry with fresh estimation |
| `SponsorshipError` | No (policy decision) | Fall back to unsponsored, or surface to user |
| `BundlerError` | Sometimes | Retry against same/alternate bundler endpoint |
| `NetworkError` | Yes | Retry with backoff |
| `ContractExecutionError` | No | Surface revert reason to developer; not an SDK bug |

## Translation Responsibility

Translation from raw ERC-4337 `AA##` codes and bundler JSON-RPC errors
into the categories above is owned by the Error Translator component
(see `ARCHITECTURE.md`), invoked at the boundary of the Bundler Client
and Transaction Engine — never left to individual call sites.
