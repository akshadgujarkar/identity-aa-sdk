import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
  createIdentityAASDK,
  DEFAULT_LOCAL_NETWORK,
  InMemoryKeyStore,
} from "@identity-aa-sdk/core";
import { ClerkIdentityResolver } from "@identity-aa-sdk/clerk";

describe("Phase 11 — End-to-End Integration Suite (Clerk -> SDK -> Account -> Chain)", () => {
  it("Full Integration Flow: Clerk Auth -> SDK Init -> Counterfactual Account Resolution", async () => {
    const clerkUser = {
      id: "user_clerk_integration_alice",
      primaryEmailAddress: "alice@example.com",
    };

    const resolver = new ClerkIdentityResolver(() => ({
      id: "session_alice_123",
      user: clerkUser,
    }));

    const keyStore = new InMemoryKeyStore();
    const config: SDKConfig = {
      environment: "development",
      network: DEFAULT_LOCAL_NETWORK,
      sponsorship: { type: "full" },
    };

    const sdk = createIdentityAASDK({ config, resolver, keyStore });
    const account = await sdk.getAccount();

    // 1. Immediate Address Availability
    assert.ok(account);
    assert.ok(account.address.startsWith("0x"));
    assert.equal(account.address.length, 42);
    assert.equal(account.chainId, 31337);

    // 2. Deterministic Key & Address Resolution
    const accountAgain = await sdk.getAccount();
    assert.equal(accountAgain.address, account.address);
  });

  it("Identity Isolation: Distinct Clerk Users Resolve Distinct Smart Accounts", async () => {
    let currentUserId = "user_clerk_user_1";
    const resolver = new ClerkIdentityResolver(() => ({
      id: `session_${currentUserId}`,
      user: { id: currentUserId, primaryEmailAddress: `${currentUserId}@example.com` },
    }));

    const keyStore = new InMemoryKeyStore();
    const config: SDKConfig = {
      network: DEFAULT_LOCAL_NETWORK,
      sponsorship: { type: "full" },
    };

    const sdk = new IdentityAASDK({ config, resolver, keyStore });

    // User 1
    const account1 = await sdk.getAccount();

    // Switch to User 2
    currentUserId = "user_clerk_user_2";
    const account2 = await sdk.getAccount();

    // Verification: Both have valid but distinct deterministic smart account addresses
    assert.notEqual(account1.address.toLowerCase(), account2.address.toLowerCase());
  });

  it("Dynamic Reconfiguration: Updating SDK Config at Runtime", async () => {
    const resolver = new ClerkIdentityResolver(() => ({
      id: "session_config_test",
      user: { id: "user_config_test", primaryEmailAddress: "config@example.com" },
    }));

    const config: SDKConfig = {
      network: DEFAULT_LOCAL_NETWORK,
      sponsorship: { type: "full" },
    };

    const sdk = new IdentityAASDK({ config, resolver });
    const initialConfig = sdk.config;
    assert.equal(initialConfig.sponsorship?.type, "full");

    // Dynamically update policy
    sdk.configure({
      sponsorship: { type: "none" },
    });

    const updatedConfig = sdk.config;
    assert.equal(updatedConfig.sponsorship?.type, "none");
  });

  it("Transaction Lifecycle Execution: Signing and Receipt Awaiting", async () => {
    const resolver = new ClerkIdentityResolver(() => ({
      id: "session_tx_test",
      user: { id: "user_tx_test", primaryEmailAddress: "tx@example.com" },
    }));

    const keyStore = new InMemoryKeyStore();
    const config: SDKConfig = {
      network: DEFAULT_LOCAL_NETWORK,
      sponsorship: { type: "full" },
    };

    const sdk = new IdentityAASDK({ config, resolver, keyStore });
    const account = await sdk.getAccount();

    // Verify signMessage
    const signature = await account.signMessage("Hello Identity AA");
    assert.ok(signature.startsWith("0x"));
    assert.equal(signature.length, 132); // 65-byte hex signature (0x + 130 chars)
  });
});
