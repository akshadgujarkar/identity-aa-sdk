# Bundler Abstraction

## Responsibilities

The Bundler Client is the SDK's only point of contact with bundler
infrastructure. It is entirely internal.

| Responsibility | Required Operation |
|---|---|
| Gas estimation | `eth_estimateUserOperationGas`-equivalent |
| Submission | `eth_sendUserOperation`-equivalent |
| Receipt retrieval | `eth_getUserOperationReceipt`-equivalent (polled) |
| Nonce query | `EntryPoint.getNonce` view call |
| Counterfactual address query | Factory / `getSenderAddress`-equivalent view call |

## RPC Abstraction

- The Bundler Client wraps a configured bundler RPC endpoint (see
  `CONFIGURATION.md`). The developer never supplies or sees a raw
  JSON-RPC method name.
- Bundler responses are translated into SDK-internal types before
  reaching the Transaction Engine; raw bundler error payloads never
  reach the public API (see `ERROR_MODEL.md`).

## Estimation

- Estimation must run before signing (fields feed into the signed
  hash), and its result feeds `preVerificationGas`,
  `verificationGasLimit`, `callGasLimit`, and (if sponsorship is
  active) `paymasterVerificationGasLimit`/`paymasterPostOpGasLimit`.

## Receipt Polling

- Polling interval and max duration are configurable (see
  `CONFIGURATION.md`), with a sane development-mode default.
- Polling must stop and surface `Dropped` (see `TRANSACTION_ENGINE.md`)
  if the operation is no longer known to the bundler before
  confirmation.

## Retry Behavior

- Only network-level submission calls (not validation-rejected
  operations) are eligible for internal retry, with bounded backoff.

## Timeout Behavior

- Submission and receipt-polling both have independent, configurable
  timeouts (see `CONFIGURATION.md`).

## Network Configuration

- One bundler endpoint per configured chain (see `CONFIGURATION.md`).
  No dynamic bundler discovery/selection in the MVP.

## Local Development

- Local development requires a locally running bundler process
  compatible with the ERC-4337 JSON-RPC surface above, pointed at a
  local EntryPoint deployment. See `LOCAL_DEVELOPMENT.md`.

## Production Strategy

- Production uses a hosted/managed bundler service reachable over the
  configured RPC endpoint. The SDK does not implement its own
  bundler — building a custom bundler is explicitly out of scope (see
  `NON_GOALS.md`).
