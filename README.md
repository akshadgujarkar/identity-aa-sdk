# Identity AA SDK

> Deterministic, Web2-identity-driven ERC-4337 Account Abstraction SDK. Turn any authenticated user session into a self-custodial smart account with 100% gas sponsorship and zero seed phrases.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![ERC-4337](https://img.shields.io/badge/ERC--4337-v0.7-purple.svg)](https://eips.ethereum.org/EIPS/eip-4337)
[![React](https://img.shields.io/badge/React-18%20%7C%2019-61dafb.svg)](https://react.dev/)

---

## Overview

**Identity AA SDK** bridges the gap between traditional Web2 identity providers (like Clerk) and self-custodial Ethereum smart accounts (ERC-4337). 

Traditional Web3 onboarding forces users through browser wallet extensions, seed phrase backups, and acquiring native gas tokens before performing their first transaction. **Identity AA SDK** removes this friction completely:

1. **Identity to Smart Account**: Automatically derives a deterministic, counterfactual smart account address (`CREATE2`) bound to the user's verified identity (e.g., Clerk User ID).
2. **Deterministic & Isolated**: The same user always gets the exact same smart account address across devices, while different users remain cryptographically isolated.
3. **Zero Native Gas (Paymaster Sponsorship)**: Executes transactions with 100% gas sponsorship via ERC-4337 paymasters. Users never need ETH or native tokens to pay for gas.
4. **Lazy Counterfactual Deployment**: The smart account is deployed on-chain automatically during the user's very first transaction (`initCode`), eliminating upfront deployment costs.

---

## Architecture & Workflow

```
┌─────────────────────────┐
│     User / App UI       │
└────────────┬────────────┘
             │ 1. Authenticates (Clerk / Auth Provider)
             ▼
┌─────────────────────────┐
│  ClerkIdentityResolver  │  Translates session into AppIdentity { provider, subjectId }
└────────────┬────────────┘
             │ 2. Passes Identity
             ▼
┌─────────────────────────┐
│     IdentityAASDK       │  - Derives deterministic salt: keccak256(AccountKey)
│   (AccountManager)      │  - Computes CREATE2 counterfactual address from Factory
└────────────┬────────────┘
             │ 3. User calls account.sendTransaction(intent)
             ▼
┌─────────────────────────┐
│   TransactionEngine     │  - Evaluates Gas Sponsorship Policy
│    (State Machine)      │  - Builds & signs PackedUserOperation with LocalSigner
└────────────┬────────────┘
             │ 4. Submits eth_sendUserOperation
             ▼
┌─────────────────────────┐
│   ERC-4337 Bundler      │  Submits handleOps([userOp]) on-chain
└────────────┬────────────┘
             │ 5. Executes on EVM
             ▼
┌──────────────────────────────────────────────────────────────┐
│  EntryPoint (0x5FbDB... / 0x0000000071727De22E5E9d8BAf0ed...)│
│   ├── 1. Runs initCode (SmartAccountFactory.createAccount)   │
│   ├── 2. Validates Paymaster deposit & gas policy            │
│   └── 3. Executes SmartAccount.execute(target, value, data)  │
└──────────────────────────────────────────────────────────────┘
```

---

## Monorepo Packages

| Package | Version | Description |
| :--- | :--- | :--- |
| [`@identity-aa-sdk/core`](./packages/core) | `0.1.0` | Framework-agnostic core SDK (Account resolution, transaction engine, paymaster, userOp encoders). |
| [`@identity-aa-sdk/clerk`](./packages/clerk) | `0.1.0` | Clerk authentication adapter implementing `IdentityResolver`. |
| [`@identity-aa-sdk/react`](./packages/react) | `0.1.0` | React context provider (`<IdentityAAProvider />`) and hooks (`useSmartAccount`, `useTransaction`). |
| [`demo`](./demo) | `0.1.0` | Interactive React + Vite demo application with live Anvil testing & guestbook flow. |

---

## Features

- ⚡ **ERC-4337 v0.7 Compliant**: Uses standard `PackedUserOperation`, `accountGasLimits`, and `paymasterAndData` structures.
- 🔑 **Seedless & Non-Custodial**: Client-side `LocalSigner` creates and manages scoped ECDSA signing keys in secure local storage or memory.
- ⛽ **Gas Policy & Sponsorship**: Built-in `GasPolicyManager` supporting `"full"`, `"conditional"` (contract/method allowlisting, rate limits, spend caps), or `"none"` sponsorship policies.
- 📦 **Batch Transactions**: Send single actions with `sendTransaction()` or multi-call batches atomically with `execute([intent1, intent2])`.
- 🔄 **9-State Observable Lifecycle**: Observable transaction state machine (`Building` $\rightarrow$ `Estimating` $\rightarrow$ `Signing` $\rightarrow$ `Submitting` $\rightarrow$ `Pending` $\rightarrow$ `Confirmed` / `Failed` / `Dropped`).
- 🛡️ **Fail-Closed Security**: Frontend configuration validator strictly rejects accidental inclusion of backend secrets (e.g. `clerkSecretKey`).
- ⚛️ **Modern React Hooks**: First-class support for React 18 and 19 with SSR-safe context and reactive state updates.

---

## Requirements

- **Node.js**: `>= 18.0.0`
- **TypeScript**: `>= 5.0.0` (when using TypeScript)
- **EVM JSON-RPC Node**: Any EVM network (Local Anvil/Hardhat, Sepolia, Arbitrum, Base, Optimism, Polygon, etc.)
- **ERC-4337 Bundler**: Compatible bundler URL (Pimlico, Biconomy, Alchemy, Stackup, or local dev bundler)

---

## Installation

Install the required packages in your project:

```bash
# Core SDK and Clerk adapter
npm install @identity-aa-sdk/core @identity-aa-sdk/clerk

# If building a React application, also install the React bindings:
npm install @identity-aa-sdk/react
```

### Peer Dependencies
If using React and Clerk, ensure you have their peer packages installed:
```bash
npm install react react-dom @clerk/clerk-react
```

---

## Quick Start

### 1. React Application with Clerk

Wrap your application in `<ClerkProvider>` and `<IdentityAAProvider>`, then execute gas-sponsored transactions directly from components using `useSmartAccount` and `useTransaction`.

```tsx
import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useSession, SignInButton, SignedIn, SignedOut } from "@clerk/clerk-react";
import { ClerkIdentityResolver } from "@identity-aa-sdk/clerk";
import { IdentityAAProvider, useSmartAccount, useTransaction, type SDKConfig } from "@identity-aa-sdk/react";

// 1. Configure the SDK
const sdkConfig: SDKConfig = {
  environment: "development",
  network: {
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    bundlerUrl: "http://127.0.0.1:4337",
    entryPointAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    factoryAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    paymasterAddress: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  },
  sponsorship: {
    type: "full", // 100% gas sponsored by Paymaster
  },
};

// 2. Main App Component
function App() {
  const { session } = useSession();

  // Pass Clerk session accessor into the resolver
  const resolver = new ClerkIdentityResolver(() => session);

  return (
    <SignedOut>
      <SignInButton mode="modal" />
    </SignedOut>
    <SignedIn>
      <IdentityAAProvider config={sdkConfig} resolver={resolver} autoResolve={true}>
        <SmartWalletView />
      </IdentityAAProvider>
    </SignedIn>
  );
}

// 3. Smart Account & Transaction Component
function SmartWalletView() {
  const { address, isDeployed, isLoading: isResolving } = useSmartAccount();
  const { send, isLoading: isSending, isSuccess, transactionHash, userOpHash, error } = useTransaction();
  const [recipient, setRecipient] = useState("0x0000000000000000000000000000000000000001");

  const handleSend = async () => {
    try {
      await send({
        to: recipient as `0x${string}`,
        value: 0n,
        data: "0x",
      });
    } catch (err) {
      console.error("Transaction failed:", err);
    }
  };

  if (isResolving) return <div>Resolving Smart Account...</div>;

  return (
    <div style={{ padding: "24px", fontFamily: "sans-serif" }}>
      <h2>Smart Account Dashboard</h2>
      <p><strong>Address:</strong> <code>{address}</code></p>
      <p><strong>On-Chain Status:</strong> {isDeployed ? "Deployed" : "Counterfactual (Ready)"}</p>

      <button onClick={handleSend} disabled={isSending}>
        {isSending ? "Submitting to Bundler..." : "Send Sponsored Transaction"}
      </button>

      {isSuccess && (
        <div style={{ marginTop: "16px", color: "green" }}>
          <p>✓ Transaction Confirmed!</p>
          <p><strong>UserOp Hash:</strong> <code>{userOpHash}</code></p>
          <p><strong>On-Chain Tx Hash:</strong> <code>{transactionHash}</code></p>
        </div>
      )}

      {error && <p style={{ color: "red" }}>Error: {error.message}</p>}
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <ClerkProvider publishableKey="pk_test_YOUR_CLERK_PUBLISHABLE_KEY">
    <App />
  </ClerkProvider>
);
```

---

### 2. Node.js / Framework-Agnostic Core SDK

You can also use the Core SDK directly in vanilla TypeScript or backend services:

```typescript
import { createIdentityAASDK, type SDKConfig, type IdentityResolver } from "@identity-aa-sdk/core";

// 1. Define or mock an IdentityResolver
const resolver: IdentityResolver = {
  async resolve() {
    return {
      provider: "clerk",
      subjectId: "user_2N0X9abcd1234efgh",
      email: "alex@example.com",
    };
  },
};

// 2. Initialize SDK
const sdk = createIdentityAASDK({
  config: {
    environment: "development",
    network: {
      chainId: 31337,
      rpcUrl: "http://127.0.0.1:8545",
      bundlerUrl: "http://127.0.0.1:4337",
      entryPointAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      factoryAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      paymasterAddress: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    },
    sponsorship: { type: "full" },
  },
  resolver,
});

async function main() {
  // 3. Resolve Smart Account
  const account = await sdk.getAccount();
  console.log("Smart Account Address:", account.address);
  console.log("Is Deployed:", account.isDeployed);

  // 4. Send a Sponsored Transaction
  const handle = await account.sendTransaction({
    to: "0x0000000000000000000000000000000000000001",
    value: 0n,
    data: "0x",
  });

  console.log("UserOperation submitted. Waiting for confirmation...");
  const receipt = await handle.wait();
  console.log("Transaction mined in block:", receipt.blockNumber);
  console.log("On-chain Tx Hash:", receipt.transactionHash);
  console.log("UserOp Hash:", receipt.userOpHash);
}

main();
```

---

## Configuration Reference

The SDK configuration object adheres to the `SDKConfig` interface:

```typescript
export interface SDKConfig {
  /** Runtime environment. Options: "development" | "production" | "test". Default: "development" */
  readonly environment?: Environment;
  /** EVM Network & ERC-4337 contract addresses */
  readonly network: NetworkConfig;
  /** Gas sponsorship policy */
  readonly sponsorship?: SponsorshipPolicy;
  /** Optional Clerk publishable key */
  readonly clerkPublishableKey?: string;
  /** FORBIDDEN in frontend config: clerkSecretKey will throw ConfigurationError if present */
  readonly clerkSecretKey?: never;
}
```

### NetworkConfig Properties

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chainId` | `number` | **Yes** | Target EVM Chain ID (e.g. `31337` for Anvil, `11155111` for Sepolia, `8453` for Base). |
| `rpcUrl` | `string` | **Yes** | JSON-RPC HTTP endpoint URL for blockchain reads and nonce queries. |
| `entryPointAddress` | `0x${string}` | **Yes** | Canonical ERC-4337 EntryPoint contract address. |
| `bundlerUrl` | `string` | Optional | ERC-4337 Bundler JSON-RPC endpoint (e.g. `http://127.0.0.1:4337`). |
| `factoryAddress` | `0x${string}` | Optional | Deployed `SmartAccountFactory` address for counterfactual derivation and deployment. |
| `paymasterAddress` | `0x${string}` | Optional | Deployed `Paymaster` address for gas sponsorship. |

### SponsorshipPolicy Configuration

```typescript
// 1. Full Sponsorship (Sponsors 100% of transactions)
const fullPolicy: SponsorshipPolicy = {
  type: "full",
};

// 2. Conditional Sponsorship (Allowlisted contracts & rate limiting)
const conditionalPolicy: SponsorshipPolicy = {
  type: "conditional",
  allowlist: {
    contracts: ["0x34d18Ac71fbABeB8b1cd016F83014235eA35F2e7"],
    methods: ["0xa9059cbb"], // ERC-20 transfer selector
  },
  rateLimit: {
    maxTransactions: 10,
    windowSeconds: 3600, // Max 10 transactions per hour per user
  },
  spendCap: {
    maxGasWei: 10000000000000000n, // Max 0.01 ETH in gas per day
    periodSeconds: 86400,
  },
  fallbackToUnsponsored: false,
};

// 3. No Sponsorship (User pays their own gas)
const noPolicy: SponsorshipPolicy = {
  type: "none",
};
```

---

## Core API Reference

### `createIdentityAASDK(options)`
Instantiates a new `IdentityAASDK` client instance.
- **Parameters**: `options: IdentityAASDKOptions` (`{ config, resolver, keyStore? }`)
- **Returns**: `IdentityAASDK` instance.

### `sdk.getAccount(identity?)`
Resolves the deterministic `Account` for the authenticated identity.
- **Parameters**: `identity?: AppIdentity` (Optional override. If omitted, resolved via configured `IdentityResolver`).
- **Returns**: `Promise<Account>`

### `account.sendTransaction(intent)`
Builds, signs, sponsors, and submits a single transaction intent to the bundler.
- **Parameters**: `intent: TransactionIntent` (`{ to, value?, data? }`)
- **Returns**: `Promise<TransactionHandle>` with `.wait(timeoutMs?)` method resolving to `Receipt`.

### `account.execute(intents)`
Executes an atomic batch of multiple transaction intents in a single UserOperation.
- **Parameters**: `intents: TransactionIntent[]`
- **Returns**: `Promise<TransactionHandle>`

---

## React Hooks Reference

### `<IdentityAAProvider />`
Context provider that instantiates and holds the SDK instance and manages account state.
- **Props**:
  - `config`: `SDKConfig`
  - `resolver`: `IdentityResolver`
  - `autoResolve?`: `boolean` (Default: `true`)
  - `keyStore?`: `KeyStore`
  - `client?`: `IdentityAASDK` (Alternative to passing `config` + `resolver`)

### `useSmartAccount()`
Hook to access current smart account metadata and deployment state.
```typescript
const {
  account,     // Account instance | undefined
  address,     // 0x... hex address | undefined
  isDeployed,  // boolean (true once deployed on-chain)
  chainId,     // number | undefined
  isLoading,   // boolean
  error,       // Error | undefined
  refetch,     // () => Promise<Account | undefined>
} = useSmartAccount();
```

### `useTransaction(options?)`
Hook to execute transactions and observe lifecycle state transitions.
```typescript
const {
  send,            // (intent: TransactionIntent) => Promise<Receipt>
  execute,         // (intents: TransactionIntent[]) => Promise<Receipt>
  sendAsync,       // (intent: TransactionIntent) => Promise<TransactionHandle>
  state,           // "idle" | "building" | "estimating" | "signing" | "submitting" | "pending" | "confirmed" | "failed"
  status,          // "idle" | "loading" | "success" | "error"
  isLoading,       // boolean
  isSuccess,       // boolean
  isError,         // boolean
  error,           // Error | undefined
  receipt,         // Receipt | undefined
  userOpHash,      // ERC-4337 UserOperation hash
  transactionHash, // Mined on-chain Ethereum transaction hash
  reset,           // () => void
} = useTransaction({
  onSuccess: (receipt) => console.log("Success!", receipt),
  onError: (error) => console.error("Failed!", error),
  timeoutMs: 60000,
});
```

---

## Error Handling & Categories

All errors thrown by the SDK inherit from `SDKError` and contain typed `code`, `category`, and `retryable` properties:

```typescript
import {
  SDKError,
  IdentityError,
  AccountError,
  SigningError,
  TransactionError,
  GasError,
  SponsorshipError,
  BundlerError,
  NetworkError,
  ContractExecutionError,
  ConfigurationError,
} from "@identity-aa-sdk/core";

try {
  await account.sendTransaction({ to: "0x...", value: 0n });
} catch (err) {
  if (err instanceof SponsorshipError) {
    console.warn(`Sponsorship denied: ${err.message} (Code: ${err.code})`);
  } else if (err instanceof BundlerError) {
    console.error(`Bundler rejected UserOp: ${err.message} (Retryable: ${err.retryable})`);
  } else if (err instanceof SDKError) {
    console.error(`SDK Error [${err.category}] (${err.code}): ${err.message}`);
  }
}
```

### Error Categories Table

| Error Class | Category | Typical Cause | Retryable |
| :--- | :--- | :--- | :--- |
| `IdentityError` | `"IdentityError"` | No active Clerk session, missing user ID, or expired auth. | No |
| `AccountError` | `"AccountError"` | Counterfactual derivation failure or invalid salt. | No |
| `SigningError` | `"SigningError"` | Key generation or signature signing error. | No |
| `SponsorshipError` | `"SponsorshipError"` | Rate limit exceeded, spend cap reached, or contract not allowlisted. | No |
| `GasError` | `"GasError"` | Gas estimation RPC error or implausible gas fee parameters. | Yes |
| `BundlerError` | `"BundlerError"` | Bundler RPC unreachable or rejected by EntryPoint. | Yes |
| `NetworkError` | `"NetworkError"` | EVM node network timeout or connectivity drop. | Yes |
| `ContractExecutionError` | `"ContractExecutionError"` | Smart contract execution reverted on-chain. | No |
| `ConfigurationError` | `"ConfigurationError"` | Malformed config, invalid address format, or secret key leaked. | No |

---

## Local Development & Testing

The repository contains a full testing suite including smart contract unit tests, SDK unit tests, smoke tests, and an end-to-end local bundler.

### 1. Start Local Anvil Blockchain
```bash
# Terminal 1: Start Anvil chain
npm run chain
```

### 2. Deploy Contracts (EntryPoint, Factory, Paymaster)
```bash
forge script script/DeployScaffold.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 3. Start Local ERC-4337 Bundler
```bash
# Terminal 2: Run standalone bundler
npm run bundler
```

### 4. Run Interactive Demo Application
```bash
# Terminal 3: Start Vite demo
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### 5. Running Monorepo Test Suites
```bash
# Run all 115+ tests across all packages
npm test

# Run unit tests only
npm run test:unit

# Run smoke tests
npm run test:smoke

# Run Foundry contract tests
npm run test:contracts
```

---

## Troubleshooting

| Problem | Root Cause | Solution |
| :--- | :--- | :--- |
| `AA13 initCode failed or OOG` | Insufficient `verificationGasLimit` allocated for `CREATE2` deployment during first transaction. | The SDK and bundler allocate `1,500,000` verification gas when deploying accounts. Ensure your bundler does not override this limit. |
| `ConfigurationError: Forbidden field clerkSecretKey` | A secret key was included in the frontend configuration object. | Remove `clerkSecretKey`. Frontend SDK only requires `clerkPublishableKey`. Never leak secret keys into client bundles. |
| `No active Clerk session found` | `useSmartAccount()` or `account.sendTransaction()` was called before the user signed in. | Wrap your components in Clerk's `<SignedIn>` or verify `session !== null` before rendering `<IdentityAAProvider>`. |
| `SponsorshipError: Policy denies sponsorship` | The target contract or method is not on the `allowlist`, or rate limit was exceeded. | Check `sdkConfig.sponsorship` settings or set `sponsorship: { type: "full" }` for unrestricted testing. |
| `Bundler unreachable` | The local bundler service is not running on port `4337`. | Run `npm run bundler` in a separate terminal. In development mode, the SDK falls back to deterministic safe gas limits. |

---

## License

This project is licensed under the **MIT License**.
