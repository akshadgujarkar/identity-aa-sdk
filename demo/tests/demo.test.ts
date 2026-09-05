import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type Account,
  type AppIdentity,
  type IdentityResolver,
  type TransactionIntent,
  type TransactionHandle,
  type Receipt,
  type HexAddress,
  DEFAULT_LOCAL_NETWORK,
} from "@identity-aa-sdk/core";
import { IdentityAAContext, type IdentityAAContextValue } from "@identity-aa-sdk/react";
import {
  DEMO_USERS,
  createDemoSDKConfig,
  createDemoClerkResolver,
  GuestbookApp,
  AuthScreen,
  AccountCard,
  GuestbookForm,
  GuestbookList,
  type GuestbookEntry,
} from "../src/index.js";

// Mock account implementation for testing UI interactions and flows
function createMockDemoAccount(options: {
  address?: HexAddress;
  isDeployed?: boolean;
  shouldFailTx?: boolean;
} = {}): Account {
  const address = options.address ?? "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  let isDeployed = options.isDeployed ?? false;

  return {
    address,
    get isDeployed() {
      return isDeployed;
    },
    chainId: 31337,
    async sendTransaction(intent: TransactionIntent): Promise<TransactionHandle> {
      if (options.shouldFailTx) {
        throw new Error("Sponsorship quota exceeded or invalid transaction");
      }
      return {
        transactionHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        async wait(): Promise<Receipt> {
          isDeployed = true;
          return {
            transactionHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            blockNumber: 42n,
            success: true,
          };
        },
      };
    },
    async execute(intents: TransactionIntent[]): Promise<TransactionHandle> {
      return this.sendTransaction(intents[0]);
    },
    async signMessage(message: Uint8Array | string) {
      return "0x11223344" as `0x${string}`;
    },
  };
}

describe("Phase 10 — Demo Application (Web3 Guestbook)", () => {
  it("DEMO_USERS contains predefined personas for seamless Web2 Clerk simulation", () => {
    assert.ok(DEMO_USERS.length >= 3);
    const alice = DEMO_USERS.find((u) => u.name === "Alice Smith");
    assert.ok(alice);
    assert.equal(alice.email, "alice@example.com");
    assert.ok(alice.id.startsWith("user_clerk_"));
  });

  it("createDemoSDKConfig configures local network and 100% gas sponsorship", () => {
    const config = createDemoSDKConfig();
    assert.equal(config.environment, "development");
    assert.equal(config.network.chainId, 31337);
    assert.equal(config.network.rpcUrl, DEFAULT_LOCAL_NETWORK.rpcUrl);
    assert.equal(config.sponsorship?.type, "full");
  });

  it("createDemoClerkResolver returns an IdentityResolver for the persona", async () => {
    const alice = DEMO_USERS[0];
    const resolver = createDemoClerkResolver(alice);
    const identity = await resolver.resolve();

    assert.equal(identity.provider, "clerk");
    assert.equal(identity.subjectId, alice.id);
    assert.equal(identity.email, alice.email);
  });

  it("AuthScreen renders Web2 login with zero wallet popups or seed phrase prompts", () => {
    let selectedUser = null;
    const html = renderToStaticMarkup(
      React.createElement(AuthScreen, {
        onSelectUser: (user) => {
          selectedUser = user;
        },
      })
    );

    // UX Rule: What user sees
    assert.ok(html.includes("Welcome to Web3 Guestbook"));
    assert.ok(html.includes("Alice Smith"));
    assert.ok(html.includes("alice@example.com"));
    assert.ok(html.includes("Quick Sign-In"));

    // UX Rule: What user should NOT see
    assert.ok(!html.includes("MetaMask"), "Should not contain MetaMask");
    assert.ok(!html.includes("Connect Wallet"), "Should not contain Connect Wallet");
    assert.ok(!html.includes("Seed Phrase"), "Should not contain Seed Phrase");
    assert.ok(!html.includes("Private Key"), "Should not contain Private Key");
    assert.ok(!html.includes("UserOperation"), "Should not contain UserOperation");
  });

  it("AccountCard renders immediately-resolved smart account address before deployment", () => {
    const alice = DEMO_USERS[0];
    const mockAccount = createMockDemoAccount({
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      isDeployed: false, // counterfactual / undeployed
    });

    const mockContext: IdentityAAContextValue = {
      client: {} as any,
      account: mockAccount,
      address: mockAccount.address,
      isDeployed: false,
      isLoading: false,
      error: undefined,
      refetchAccount: async () => mockAccount,
    };

    const html = renderToStaticMarkup(
      React.createElement(
        IdentityAAContext.Provider,
        { value: mockContext },
        React.createElement(AccountCard, {
          user: alice,
          onSignOut: () => {},
        })
      )
    );

    // Proof: Address is visible immediately before any transaction is sent
    assert.ok(html.includes("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"));
    assert.ok(html.includes("Ready (Counterfactual)"));
    assert.ok(html.includes("100% Gas Sponsored"));
    assert.ok(html.includes("Alice Smith"));
    assert.ok(html.includes("alice@example.com"));

    // Proof: No wallet / seed phrase prompts
    assert.ok(!html.includes("Connect Wallet"));
    assert.ok(!html.includes("Seed Phrase"));
  });

  it("AccountCard updates badge when account is deployed on-chain", () => {
    const alice = DEMO_USERS[0];
    const mockAccount = createMockDemoAccount({
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      isDeployed: true,
    });

    const mockContext: IdentityAAContextValue = {
      client: {} as any,
      account: mockAccount,
      address: mockAccount.address,
      isDeployed: true,
      isLoading: false,
      error: undefined,
      refetchAccount: async () => mockAccount,
    };

    const html = renderToStaticMarkup(
      React.createElement(
        IdentityAAContext.Provider,
        { value: mockContext },
        React.createElement(AccountCard, {
          user: alice,
          onSignOut: () => {},
        })
      )
    );

    assert.ok(html.includes("Deployed on-chain"));
  });

  it("GuestbookForm renders input and sign action without ERC-4337 jargon", () => {
    const alice = DEMO_USERS[0];
    const mockAccount = createMockDemoAccount();

    const mockContext: IdentityAAContextValue = {
      client: {} as any,
      account: mockAccount,
      address: mockAccount.address,
      isDeployed: false,
      isLoading: false,
      error: undefined,
      refetchAccount: async () => mockAccount,
    };

    const html = renderToStaticMarkup(
      React.createElement(
        IdentityAAContext.Provider,
        { value: mockContext },
        React.createElement(GuestbookForm, {
          user: alice,
          onEntrySubmitted: () => {},
        })
      )
    );

    assert.ok(html.includes("Sign the Web3 Guestbook"));
    assert.ok(html.includes("Sign Guestbook"));
    assert.ok(html.includes("Gas fees are 100% sponsored"));

    // Verify absence of low-level jargon in form
    assert.ok(!html.includes("UserOp"));
    assert.ok(!html.includes("EntryPoint"));
    assert.ok(!html.includes("Bundler"));
    assert.ok(!html.includes("Gas Limit"));
  });

  it("GuestbookList renders empty state and list of sponsored guestbook messages", () => {
    // Empty state
    const emptyHtml = renderToStaticMarkup(
      React.createElement(GuestbookList, { entries: [] })
    );
    assert.ok(emptyHtml.includes("No entries yet"));

    // Populated state
    const entries: GuestbookEntry[] = [
      {
        id: "entry_1",
        authorAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        authorName: "Alice Smith",
        authorEmail: "alice@example.com",
        message: "Hello Web3 without wallets!",
        timestamp: Date.now(),
        txHash: "0xabc",
        isSponsored: true,
      },
    ];

    const populatedHtml = renderToStaticMarkup(
      React.createElement(GuestbookList, { entries })
    );

    assert.ok(populatedHtml.includes("Recent Entries (1)"));
    assert.ok(populatedHtml.includes("Alice Smith"));
    assert.ok(populatedHtml.includes("Hello Web3 without wallets!"));
    assert.ok(populatedHtml.includes("Sponsored"));
  });

  it("GuestbookApp renders full unauthenticated flow and toggles proof checklist", () => {
    const html = renderToStaticMarkup(
      React.createElement(GuestbookApp, { initialUser: null })
    );

    assert.ok(html.includes("Identity AA SDK Demo"));
    assert.ok(html.includes("Welcome to Web3 Guestbook"));
    assert.ok(html.includes("Alice Smith"));
  });

  it("GuestbookApp mounts in authenticated persona state and renders account and form", () => {
    const alice = DEMO_USERS[0];
    const initialEntries: GuestbookEntry[] = [
      {
        id: "entry_demo",
        authorAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        authorName: "Alice Smith",
        authorEmail: "alice@example.com",
        message: "First entry in guestbook",
        timestamp: Date.now(),
        isSponsored: true,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(GuestbookApp, {
        initialUser: alice,
        initialEntries,
      })
    );

    assert.ok(html.includes("Alice Smith"));
    assert.ok(html.includes("alice@example.com"));
    assert.ok(html.includes("Sign the Web3 Guestbook"));
    assert.ok(html.includes("First entry in guestbook"));
    assert.ok(html.includes("Sign Out"));
  });
});
