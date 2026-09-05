import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type Account,
  type AppIdentity,
  type IdentityResolver,
  type SDKConfig,
  type TransactionIntent,
  type TransactionHandle,
  type Receipt,
  type HexAddress,
  IdentityAASDK,
} from "@identity-aa-sdk/core";
import {
  IdentityAAProvider,
  useIdentityAA,
  useSmartAccount,
  useTransaction,
  IdentityAAContext,
  type IdentityAAContextValue,
} from "../src/index.js";

// Mock helpers
function createMockAccount(options: {
  address?: HexAddress;
  isDeployed?: boolean;
  chainId?: number;
  shouldFailTx?: boolean;
  txSuccess?: boolean;
} = {}): Account {
  const address = options.address ?? "0x1111111111111111111111111111111111111111";
  let isDeployed = options.isDeployed ?? false;
  const chainId = options.chainId ?? 31337;

  return {
    address,
    get isDeployed() {
      return isDeployed;
    },
    chainId,
    async sendTransaction(intent: TransactionIntent): Promise<TransactionHandle> {
      if (options.shouldFailTx) {
        throw new Error("Bundler rejected userOp");
      }
      return {
        transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        async wait(): Promise<Receipt> {
          if (options.txSuccess === false) {
            return {
              transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
              blockNumber: 100n,
              success: false,
            };
          }
          isDeployed = true; // Simulates deployment on first tx
          return {
            transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            blockNumber: 100n,
            success: true,
          };
        },
      };
    },
    async execute(intents: TransactionIntent[]): Promise<TransactionHandle> {
      if (options.shouldFailTx) {
        throw new Error("Bundler rejected batch userOp");
      }
      return {
        transactionHash: "0xbatch1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        async wait(): Promise<Receipt> {
          if (options.txSuccess === false) {
            return {
              transactionHash: "0xbatch1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
              blockNumber: 101n,
              success: false,
            };
          }
          return {
            transactionHash: "0xbatch1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            blockNumber: 101n,
            success: true,
          };
        },
      };
    },
    async signMessage(message: Uint8Array | string) {
      return "0x1234" as `0x${string}`;
    },
  };
}

class MockResolver implements IdentityResolver {
  constructor(private readonly identity: AppIdentity = { provider: "clerk", subjectId: "user_test_123" }) {}
  async resolve(): Promise<AppIdentity> {
    return this.identity;
  }
}

const mockConfig: SDKConfig = {
  environment: "development",
  network: {
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  },
  sponsorship: { type: "none" },
};

describe("Phase 09 - React Adapter Provider & Hooks", () => {
  it("useIdentityAA throws descriptive error when used outside IdentityAAProvider", () => {
    function InvalidComponent() {
      useIdentityAA();
      return null;
    }

    assert.throws(
      () => {
        renderToStaticMarkup(React.createElement(InvalidComponent));
      },
      {
        message: /useIdentityAA must be used within an <IdentityAAProvider>/,
      }
    );
  });

  it("IdentityAAProvider throws error if neither client nor config+resolver is provided", () => {
    function InvalidProvider() {
      // @ts-expect-error - testing missing props
      return React.createElement(IdentityAAProvider, { children: null });
    }

    assert.throws(
      () => {
        renderToStaticMarkup(React.createElement(InvalidProvider));
      },
      {
        message: /IdentityAAProvider requires either an initialized 'client' or both 'config' and 'resolver'/,
      }
    );
  });

  it("IdentityAAProvider mounts cleanly with config and resolver", () => {
    const resolver = new MockResolver();
    let capturedContext: IdentityAAContextValue | undefined;

    function TestChild() {
      capturedContext = useIdentityAA();
      return React.createElement("div", null, "child");
    }

    const html = renderToStaticMarkup(
      React.createElement(
        IdentityAAProvider,
        { config: mockConfig, resolver, autoResolve: false },
        React.createElement(TestChild)
      )
    );

    assert.equal(html, "<div>child</div>");
    assert.ok(capturedContext);
    assert.ok(capturedContext.client instanceof IdentityAASDK);
    assert.equal(typeof capturedContext.refetchAccount, "function");
  });

  it("IdentityAAProvider mounts cleanly with direct client instance", () => {
    const resolver = new MockResolver();
    const sdk = new IdentityAASDK({ config: mockConfig, resolver });
    let capturedContext: IdentityAAContextValue | undefined;

    function TestChild() {
      capturedContext = useIdentityAA();
      return React.createElement("div", null, "child");
    }

    const html = renderToStaticMarkup(
      React.createElement(
        IdentityAAProvider,
        { client: sdk, autoResolve: false },
        React.createElement(TestChild)
      )
    );

    assert.equal(html, "<div>child</div>");
    assert.ok(capturedContext);
    assert.equal(capturedContext.client, sdk);
  });

  it("useSmartAccount reads account state and deployment status from context", async () => {
    const mockAccount = createMockAccount({
      address: "0x9999999999999999999999999999999999999999",
      isDeployed: true,
      chainId: 31337,
    });

    let refetchCalled = false;
    const mockContextValue: IdentityAAContextValue = {
      client: {} as IdentityAASDK,
      account: mockAccount,
      isLoadingAccount: false,
      accountError: undefined,
      refetchAccount: async () => {
        refetchCalled = true;
        return mockAccount;
      },
    };

    let hookResult: ReturnType<typeof useSmartAccount> | undefined;

    function TestComponent() {
      hookResult = useSmartAccount();
      return React.createElement("div", null, hookResult.address);
    }

    const html = renderToStaticMarkup(
      React.createElement(
        IdentityAAContext.Provider,
        { value: mockContextValue },
        React.createElement(TestComponent)
      )
    );

    assert.equal(html, "<div>0x9999999999999999999999999999999999999999</div>");
    assert.ok(hookResult);
    assert.equal(hookResult.address, "0x9999999999999999999999999999999999999999");
    assert.equal(hookResult.isDeployed, true);
    assert.equal(hookResult.chainId, 31337);
    assert.equal(hookResult.isLoading, false);
    assert.equal(hookResult.error, undefined);

    const refetched = await hookResult.refetch();
    assert.equal(refetchCalled, true);
    assert.equal(refetched?.address, "0x9999999999999999999999999999999999999999");
  });

  it("useTransaction successfully sends transaction and tracks state machine transitions", async () => {
    const mockAccount = createMockAccount({ isDeployed: false });
    let refetchAccountCalled = false;

    const mockContextValue: IdentityAAContextValue = {
      client: {} as IdentityAASDK,
      account: mockAccount,
      isLoadingAccount: false,
      accountError: undefined,
      refetchAccount: async () => {
        refetchAccountCalled = true;
        return mockAccount;
      },
    };

    let txHook: ReturnType<typeof useTransaction> | undefined;
    let submittedHandle: TransactionHandle | undefined;
    let successReceipt: Receipt | undefined;

    function TestComponent() {
      txHook = useTransaction({
        onSubmitted: (h) => {
          submittedHandle = h;
        },
        onSuccess: (r) => {
          successReceipt = r;
        },
      });
      return React.createElement("div", null, txHook.state);
    }

    renderToStaticMarkup(
      React.createElement(
        IdentityAAContext.Provider,
        { value: mockContextValue },
        React.createElement(TestComponent)
      )
    );

    assert.ok(txHook);
    assert.equal(txHook.state, "idle");
    assert.equal(txHook.status, "idle");
    assert.equal(txHook.isLoading, false);
    assert.equal(txHook.isSuccess, false);

    // Send transaction
    const receipt = await txHook.send({
      to: "0x2222222222222222222222222222222222222222",
      value: 0n,
    });

    assert.equal(receipt.success, true);
    assert.equal(receipt.blockNumber, 100n);
    assert.ok(submittedHandle);
    assert.ok(successReceipt);
    assert.equal(refetchAccountCalled, true); // Deployed state refreshed
  });

  it("useTransaction handles batch execution (execute)", async () => {
    const mockAccount = createMockAccount();

    const mockContextValue: IdentityAAContextValue = {
      client: {} as IdentityAASDK,
      account: mockAccount,
      isLoadingAccount: false,
      accountError: undefined,
      refetchAccount: async () => mockAccount,
    };

    let txHook: ReturnType<typeof useTransaction> | undefined;
    function TestComponent() {
      txHook = useTransaction();
      return null;
    }

    renderToStaticMarkup(
      React.createElement(
        IdentityAAContext.Provider,
        { value: mockContextValue },
        React.createElement(TestComponent)
      )
    );

    assert.ok(txHook);
    const receipt = await txHook.execute([
      { to: "0x2222222222222222222222222222222222222222", value: 0n },
      { to: "0x3333333333333333333333333333333333333333", value: 100n },
    ]);

    assert.equal(receipt.success, true);
    assert.equal(receipt.blockNumber, 101n);
  });

  it("useTransaction handles sendAsync without waiting for receipt", async () => {
    const mockAccount = createMockAccount();

    const mockContextValue: IdentityAAContextValue = {
      client: {} as IdentityAASDK,
      account: mockAccount,
      isLoadingAccount: false,
      accountError: undefined,
      refetchAccount: async () => mockAccount,
    };

    let txHook: ReturnType<typeof useTransaction> | undefined;
    function TestComponent() {
      txHook = useTransaction();
      return null;
    }

    renderToStaticMarkup(
      React.createElement(
        IdentityAAContext.Provider,
        { value: mockContextValue },
        React.createElement(TestComponent)
      )
    );

    assert.ok(txHook);
    const handle = await txHook.sendAsync({
      to: "0x2222222222222222222222222222222222222222",
      value: 0n,
    });

    assert.ok(handle.transactionHash);
    const receipt = await handle.wait();
    assert.equal(receipt.success, true);
  });

  it("useTransaction handles on-chain revert failure", async () => {
    const mockAccount = createMockAccount({ txSuccess: false });
    let errorPassedToCallback: Error | undefined;

    const mockContextValue: IdentityAAContextValue = {
      client: {} as IdentityAASDK,
      account: mockAccount,
      isLoadingAccount: false,
      accountError: undefined,
      refetchAccount: async () => mockAccount,
    };

    let txHook: ReturnType<typeof useTransaction> | undefined;
    function TestComponent() {
      txHook = useTransaction({
        onError: (err) => {
          errorPassedToCallback = err;
        },
      });
      return null;
    }

    renderToStaticMarkup(
      React.createElement(
        IdentityAAContext.Provider,
        { value: mockContextValue },
        React.createElement(TestComponent)
      )
    );

    assert.ok(txHook);
    await assert.rejects(
      async () => {
        await txHook!.send({
          to: "0x2222222222222222222222222222222222222222",
        });
      },
      {
        message: /Transaction execution reverted on-chain/,
      }
    );

    assert.ok(errorPassedToCallback);
  });

  it("useTransaction rejects when no account is in context", async () => {
    const mockContextValue: IdentityAAContextValue = {
      client: {} as IdentityAASDK,
      account: undefined,
      isLoadingAccount: false,
      accountError: undefined,
      refetchAccount: async () => undefined,
    };

    let txHook: ReturnType<typeof useTransaction> | undefined;
    function TestComponent() {
      txHook = useTransaction();
      return null;
    }

    renderToStaticMarkup(
      React.createElement(
        IdentityAAContext.Provider,
        { value: mockContextValue },
        React.createElement(TestComponent)
      )
    );

    assert.ok(txHook);
    await assert.rejects(
      async () => {
        await txHook!.send({
          to: "0x2222222222222222222222222222222222222222",
        });
      },
      {
        message: /Cannot send transaction: No active account resolved/,
      }
    );
  });

  it("useTransaction reset() restores initial state", () => {
    const mockAccount = createMockAccount();

    const mockContextValue: IdentityAAContextValue = {
      client: {} as IdentityAASDK,
      account: mockAccount,
      isLoadingAccount: false,
      accountError: undefined,
      refetchAccount: async () => mockAccount,
    };

    let txHook: ReturnType<typeof useTransaction> | undefined;
    function TestComponent() {
      txHook = useTransaction();
      return null;
    }

    renderToStaticMarkup(
      React.createElement(
        IdentityAAContext.Provider,
        { value: mockContextValue },
        React.createElement(TestComponent)
      )
    );

    assert.ok(txHook);
    assert.equal(txHook.state, "idle");
    assert.equal(typeof txHook.reset, "function");
    txHook.reset();
    assert.equal(txHook.state, "idle");
    assert.equal(txHook.error, undefined);
  });
});
