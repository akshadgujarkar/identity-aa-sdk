# Design Decisions

| Decision | Context | Options | Chosen Approach | Reason | Trade-offs | Security Implications | Future Migration |
|---|---|---|---|---|---|---|---|
| Identity provider | Need a Web2 auth source | Clerk, Auth0, custom | Clerk (MVP-exclusive) | Explicit project requirement; strong session model | Locks MVP to one provider | Identity/signing separation limits blast radius of provider choice | `IdentityResolver` interface allows adding providers later (`ROADMAP.md`) |
| Identity → account mapping | Need reproducible account addresses | Central DB lookup, deterministic derivation | Deterministic derivation (`AccountKey` → CREATE2 salt) | No single point of failure; verifiable independently | Slightly more upfront design work | Removes a DB-compromise attack surface for address integrity | N/A — foundational |
| Signing model | Need a signer with no wallet install | Browser key (WebCrypto), WebAuthn/passkeys, backend key, MPC | Browser-held non-extractable WebCrypto key | Achievable at MVP scope; no server custody | No recovery if device lost (MVP) | Compromise is device-scoped, not server-scoped | Migrate to WebAuthn/passkey signing (`ROADMAP.md`) |
| Smart account architecture | Need ERC-4337-compliant account | Single-owner, multi-owner/passkey from day one | Single ECDSA owner (MVP) | Matches MVP signer choice; minimal contract surface | No multi-device support yet | Simpler contract = smaller audit surface | Add owner-set/passkey verification later without breaking address derivation, if owner storage is isolated |
| Factory | Need deterministic deployment | CREATE, CREATE2 | CREATE2 | Enables counterfactual addressing | None significant | Salt must bind to owner key material to avoid hijack | N/A — required by spec |
| Bundler | Need UserOperation relaying | Build custom, use existing | Use existing/hosted bundler | Building one is out of scope (`NON_GOALS.md`) | Dependent on third-party infra reliability | Reduces SDK's own attack surface | Could self-host later without API changes |
| Paymaster | Need gas sponsorship | Build custom, use existing general-purpose | Minimal demo-scope custom paymaster | No suitable minimal existing option for MVP demo; general-purpose paymaster out of scope | Not production-hardened as shipped | Must still meet ERC-4337 EntryPoint-only gating | Replace with a production paymaster service later behind the same `GAS_ABSTRACTION.md` interface |
| Language | Need one implementation language across SDK | TypeScript, multi-language | TypeScript | Single language across `core`/`clerk`/`react`; matches target developer audience | None significant | N/A | N/A |
| Repository shape | Need to manage multiple packages | Monorepo, polyrepo | Monorepo | Coordinated versioning across `core`/`clerk`/`react`/`contracts`/`demo` | Slightly heavier tooling | N/A | N/A |
| React adapter | Need idiomatic React usage | Ship only `core`, ship a React adapter | React adapter (Phase 9) | Demo and most integrators will be React | Adds a package to maintain | N/A | Additional framework adapters follow the same pattern later |
| Network support | Need to pick MVP chain scope | Single testnet, multi-chain | Single configured chain (MVP) | Matches MVP scope; multi-chain adds config/address complexity not needed to prove the thesis | Limits initial applicability | N/A | `AccountKey` already includes `chainId`, so multi-chain is additive, not a redesign |

## Public API Abstraction Test (binding rule)

For every candidate public API, ask: *does the developer need to
understand ERC-4337 to use this?* If yes, redesign it or move it to
`core/internal`. See `API_DESIGN.md`.
