import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AccountManager,
  LocalSigner,
  InMemoryKeyStore,
  deriveAccountSalt,
  createIdentityAASDK,
  DEFAULT_LOCAL_NETWORK,
  type AppIdentity,
  type AccountKey,
  type IdentityResolver,
  type HexAddress,
  type HexData,
} from "../src/index.js";

test("AccountManager - Salt derivation is deterministic and sensitive to inputs", () => {
  const accountKey1: AccountKey = {
    identity: { provider: "clerk", subjectId: "user_alice", namespace: "app_v1" },
    chainId: 31337,
    accountImplementationVersion: "1.0.0",
    signerKeyId: "signer_0x1234",
  };

  const accountKey2: AccountKey = {
    identity: { provider: "clerk", subjectId: "user_alice", namespace: "app_v1" },
    chainId: 31337,
    accountImplementationVersion: "1.0.0",
    signerKeyId: "signer_0x1234",
  };

  const accountKeyDiffUser: AccountKey = {
    ...accountKey1,
    identity: { provider: "clerk", subjectId: "user_bob", namespace: "app_v1" },
  };

  const salt1 = deriveAccountSalt(accountKey1);
  const salt2 = deriveAccountSalt(accountKey2);
  const saltDiff = deriveAccountSalt(accountKeyDiffUser);

  assert.equal(salt1, salt2, "Identical AccountKeys must produce identical salts");
  assert.notEqual(salt1, saltDiff, "Different subjectIds must produce different salts");
  assert.equal(salt1.startsWith("0x"), true);
  assert.equal(salt1.length, 66);
});

test("AccountManager - LocalSigner key generation and cryptographic signing", async () => {
  const signer = LocalSigner.create();
  const address = await signer.getAddress();

  assert.equal(address.startsWith("0x"), true);
  assert.equal(address.length, 42);

  const message = "Hello Identity AA SDK";
  const signature = await signer.signMessage(message);
  assert.equal(signature.startsWith("0x"), true);
  assert.equal(signature.length, 132); // 65 bytes in hex + 0x

  const digest = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as HexData;
  const hashSig = await signer.signHash(digest);
  assert.equal(hashSig.startsWith("0x"), true);
  assert.equal(hashSig.length, 132);
});

test("AccountManager - First-time user resolution generates signer and returns undeployed account", async () => {
  const keyStore = new InMemoryKeyStore();

  const mockChainClient = {
    async isContractDeployed(addr: HexAddress) {
      return false;
    },
    async getCounterfactualAddress(factory: HexAddress, owner: HexAddress, salt: HexData) {
      return "0x1234567890123456789012345678901234567890" as HexAddress;
    },
  };

  const identity: AppIdentity = {
    provider: "clerk",
    subjectId: "user_new_123",
  };

  const manager = new AccountManager({
    config: {
      network: {
        ...DEFAULT_LOCAL_NETWORK,
        factoryAddress: "0xFaC7012345678901234567890123456789012345",
      },
    },
    keyStore,
    chainClient: mockChainClient as any,
  });

  const account = await manager.getAccount(identity);

  assert.equal(account.address, "0x1234567890123456789012345678901234567890");
  assert.equal(account.isDeployed, false);
  assert.equal(account.chainId, 31337);

  // Verify that keyStore now contains the generated signer
  const storedSigner = await keyStore.get(`signer_clerk_user_new_123_31337`);
  assert.notEqual(storedSigner, null);
});

test("AccountManager - Returning user reuses existing signer and checks on-chain deployment", async () => {
  const keyStore = new InMemoryKeyStore();
  const existingSigner = LocalSigner.create();
  const existingKeyId = `signer_clerk_user_returning_31337`;
  await keyStore.save(existingKeyId, existingSigner);

  const mockChainClient = {
    async isContractDeployed(addr: HexAddress) {
      return true; // Contract has been deployed
    },
    async getCounterfactualAddress(factory: HexAddress, owner: HexAddress, salt: HexData) {
      return "0xAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCdEf1234" as HexAddress;
    },
  };

  const identity: AppIdentity = {
    provider: "clerk",
    subjectId: "user_returning",
  };

  const manager = new AccountManager({
    config: {
      network: {
        ...DEFAULT_LOCAL_NETWORK,
        factoryAddress: "0xFaC7012345678901234567890123456789012345",
      },
    },
    keyStore,
    chainClient: mockChainClient as any,
  });

  const account = await manager.getAccount(identity);

  assert.equal(account.address, "0xAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCdEf1234");
  assert.equal(account.isDeployed, true);
});

test("AccountManager - Caching returns identical account instance within SDK session", async () => {
  const mockChainClient = {
    async isContractDeployed() {
      return false;
    },
    async getCounterfactualAddress() {
      return "0x9876543210987654321098765432109876543210" as HexAddress;
    },
  };

  const identity: AppIdentity = {
    provider: "clerk",
    subjectId: "user_cached",
  };

  const manager = new AccountManager({
    config: {
      network: {
        ...DEFAULT_LOCAL_NETWORK,
        factoryAddress: "0xFaC7012345678901234567890123456789012345",
      },
    },
    chainClient: mockChainClient as any,
  });

  const account1 = await manager.getAccount(identity);
  const account2 = await manager.getAccount(identity);

  assert.equal(account1, account2, "Subsequent getAccount calls must return cached reference");
});

test("AccountManager - Main SDK createIdentityAASDK interface and configuration updates", async () => {
  class MockResolver implements IdentityResolver {
    async resolve(): Promise<AppIdentity> {
      return {
        provider: "clerk",
        subjectId: "user_sdk_test",
      };
    }
  }

  const sdk = createIdentityAASDK({
    config: {
      network: {
        ...DEFAULT_LOCAL_NETWORK,
        factoryAddress: "0xFaC7012345678901234567890123456789012345",
      },
    },
    resolver: new MockResolver(),
  });

  assert.equal(sdk.config.network.chainId, 31337);

  // Configure dynamic sponsorship
  sdk.configure({
    sponsorship: {
      type: "none",
    },
  });

  assert.equal(sdk.config.sponsorship?.type, "none");
});
