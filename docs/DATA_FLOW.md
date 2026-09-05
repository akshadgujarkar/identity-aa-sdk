# Data Flow (Sequence Diagrams)

## Login

```mermaid
sequenceDiagram
    participant U as User
    participant App
    participant Clerk
    U->>App: Open app
    App->>Clerk: Redirect / widget login
    Clerk-->>App: Authenticated session
```

## Account Resolution — First-Time User

```mermaid
sequenceDiagram
    participant App
    participant SDK
    participant KeyStore as Local Key Store
    participant Chain

    App->>SDK: getAccount()
    SDK->>KeyStore: Look up signer for identity
    KeyStore-->>SDK: none found
    SDK->>KeyStore: Generate non-extractable keypair
    SDK->>Chain: Compute counterfactual address (factory view call)
    Chain-->>SDK: address, isDeployed=false
    SDK-->>App: Account{address, isDeployed:false}
```

## Account Resolution — Returning User

```mermaid
sequenceDiagram
    participant App
    participant SDK
    participant KeyStore as Local Key Store
    participant Chain

    App->>SDK: getAccount()
    SDK->>KeyStore: Look up signer for identity
    KeyStore-->>SDK: existing signer
    SDK->>Chain: Check deployment state
    Chain-->>SDK: isDeployed=true
    SDK-->>App: Account{address, isDeployed:true}
```

## Transaction (Unsponsored)

```mermaid
sequenceDiagram
    participant App
    participant SDK
    participant Bundler
    participant EntryPoint
    participant Chain

    App->>SDK: sendTransaction(intent)
    SDK->>Bundler: estimate gas
    Bundler-->>SDK: gas estimates
    SDK->>SDK: sign UserOperation
    SDK->>Bundler: submit UserOperation
    Bundler->>EntryPoint: handleOps (on inclusion)
    EntryPoint->>Chain: execute
    Chain-->>EntryPoint: result
    Bundler-->>SDK: receipt
    SDK-->>App: Receipt
```

## Sponsored Transaction

```mermaid
sequenceDiagram
    participant App
    participant SDK
    participant GasPolicy as Gas Policy
    participant Paymaster
    participant Bundler
    participant EntryPoint
    participant Chain

    App->>SDK: sendTransaction(intent)
    SDK->>GasPolicy: evaluate sponsorship
    GasPolicy-->>SDK: approved
    SDK->>Paymaster: attach paymaster data
    SDK->>SDK: sign UserOperation
    SDK->>Bundler: submit UserOperation
    Bundler->>EntryPoint: handleOps
    EntryPoint->>Paymaster: validatePaymasterUserOp
    EntryPoint->>Chain: execute
    EntryPoint->>Paymaster: postOp
    Bundler-->>SDK: receipt
    SDK-->>App: Receipt
```

## Failed Transaction

```mermaid
sequenceDiagram
    participant App
    participant SDK
    participant Bundler

    App->>SDK: sendTransaction(intent)
    SDK->>Bundler: submit UserOperation
    Bundler-->>SDK: rejection (e.g. AA23 validation failure)
    SDK->>SDK: translate error (ERROR_MODEL.md)
    SDK-->>App: TransactionError
```

## Transaction Confirmation

```mermaid
sequenceDiagram
    participant SDK
    participant Bundler
    participant Chain

    loop poll until timeout
        SDK->>Bundler: get receipt
        Bundler-->>SDK: pending
    end
    Bundler-->>SDK: receipt (confirmed)
    SDK->>SDK: mark Confirmed
```
