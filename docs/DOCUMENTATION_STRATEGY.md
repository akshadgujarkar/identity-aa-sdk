# Documentation Strategy

Two audiences read this documentation differently.

## Application Developer

Read, in order:

```text
README.md
   ↓
QUICK_START.md
   ↓
DEVELOPER_EXPERIENCE.md
   ↓
API_DESIGN.md
```

Should NOT need to read (except when debugging advanced behavior):

```text
ERC4337_INTERNAL_MAPPING.md
TRANSACTION_ENGINE.md
BUNDLER.md
```

## Antigravity / Maintainer

Read, in order:

```text
ARCHITECTURE.md
   ↓
SDK_ARCHITECTURE.md
   ↓
IDENTITY_ARCHITECTURE.md
   ↓
SMART_ACCOUNT.md
   ↓
TRANSACTION_ENGINE.md
   ↓
ERC4337_INTERNAL_MAPPING.md
   ↓
SECURITY.md
   ↓
IMPLEMENTATION_PHASES.md
```

This distinction is enforced by keeping ERC-4337 vocabulary entirely
out of the application-developer-facing docs (`README.md`,
`QUICK_START.md`, `DEVELOPER_EXPERIENCE.md`, `API_DESIGN.md`), and
concentrating it in the maintainer-facing set above.
