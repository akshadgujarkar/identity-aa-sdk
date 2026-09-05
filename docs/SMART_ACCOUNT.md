# Smart Account Requirements

This document specifies required behavior for the ERC-4337 smart
account contract. It does not contain Solidity.

## Ownership

- The account has exactly one active owner key at MVP (a public key
  corresponding to the signer described in `KEY_MANAGEMENT.md`).
- Ownership is set at initialization time and is immutable in the MVP
  (no `addOwner`/`rotateOwner` — see `ROADMAP.md` for post-MVP key
  rotation and multi-key support).

## Authorization / Validation

- MUST implement `validateUserOp` per ERC-4337 `IAccount`.
- MUST reject any caller other than the trusted `EntryPoint` address
  (configured at deployment, not user-supplied).
- MUST verify the UserOperation signature against the account's owner
  key and return `SIG_VALIDATION_FAILED` (not revert) on mismatch, per
  ERC-4337 semantics; any other error condition MUST revert.
- MUST NOT short-circuit before completing the normal validation flow,
  to preserve accurate gas estimation.
- MUST pay the EntryPoint the requested `missingAccountFunds` when
  required.

## Execution

- MUST implement an `execute` (single call) and a batched execute
  (array of calls) entry point, callable only by the `EntryPoint`.
- Execution MUST occur only after validation has succeeded, and only
  once per UserOperation (ERC-4337 guarantee).
- The account MUST NOT itself interpret or restrict the destination
  contract or calldata (that policy layer belongs to
  `GAS_ABSTRACTION.md`'s sponsorship policy, not the account).

## EntryPoint Relationship

- The account is deployed pointing at exactly one `EntryPoint` address
  per chain, taken from `CONFIGURATION.md`. It is not user-configurable
  at runtime.

## Nonce Handling

- MVP uses the EntryPoint's classic sequential nonce (nonce key `0`).
  Custom nonce keys (e.g. for parallel/administrative channels) are
  explicitly deferred — see `NON_GOALS.md`.

## Signature Verification

- Signature scheme: ECDSA over the `userOpHash` as defined by
  ERC-4337 (EIP-712-based hash, depends on chainId + EntryPoint
  address for replay protection). No alternate signature schemes in
  the MVP.

## Deployment State

- The account MAY be referenced (its address computed) before it is
  deployed ("counterfactual"). Deployment happens as a side effect of
  the account's first UserOperation, via the factory's `initCode`, per
  ERC-4337's first-time-creation flow.
- The account contract MUST NOT be deployable through any path other
  than the designated Account Factory (see `ACCOUNT_FACTORY.md`), and
  MUST NOT be re-initializable after first deployment.

## Account Initialization

- Initialization sets the owner key and the trusted EntryPoint. It
  MUST be callable only once, and only through the factory-driven
  deployment path (mirrors ERC-4337's factory-origin requirement).

## Security Boundaries

- All privileged entry points (`validateUserOp`, `execute`) MUST gate
  on `msg.sender == EntryPoint` (or `== self` where the ERC-4337
  reference implementation allows self-calls for administrative
  actions — none are in scope for MVP).
- The account holds no application-level business logic; it is a
  generic executor gated by signature validation.

## Upgradeability Considerations

- MVP: non-upgradeable, single implementation version per deployment.
- If upgradeability is introduced later, storage layout MUST follow a
  collision-resistant scheme (e.g. ERC-7201 diamond storage) — flagged
  here so a future phase does not retrofit storage incorrectly.

## Recovery Roadmap (not MVP)

Social/guardian recovery and key rotation are explicitly deferred;
see `ROADMAP.md`. The MVP owner model MUST NOT be designed in a way
that makes adding a recovery mechanism later architecturally
impossible (e.g., owner storage should be a distinct, addressable
slot, not baked into unrelated logic).
