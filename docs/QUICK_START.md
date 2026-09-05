# Quick Start

The smallest possible integration, conceptually:

```text
Initialize SDK
    ↓
Get authenticated account
    ↓
Send transaction
    ↓
Wait for confirmation
```

Illustrative shape only (not an implementation):

```typescript
const sdk = createIdentityAccount({
    auth: clerk,
    chain: sepolia,
});

const account = await sdk.getAccount();

const tx = await account.sendTransaction({
    to: contractAddress,
    data: calldata,
});

const receipt = await tx.wait();
```

Nothing above requires knowledge of `UserOperation`, `EntryPoint`,
bundlers, or paymasters. Sponsorship, batching, and message signing
are documented in `API_DESIGN.md` as the next layer once this basic
flow works.
