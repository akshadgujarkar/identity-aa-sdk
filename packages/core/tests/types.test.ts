import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  AppIdentity,
  AccountKey,
  Account,
  Signer,
  TransactionIntent,
  Receipt,
  TransactionHandle,
  SponsorshipPolicy,
  IdentityResolver,
} from "../src/types/index.js";

test("Types - AppIdentity represents provider, subjectId, and optional metadata", () => {
  const identity: AppIdentity = {
    provider: "clerk",
    subjectId: "user_2aBcDeFg",
    namespace: "org_default",
    email: "alice@example.com",
  };

  assert.equal(identity.provider, "clerk");
  assert.equal(identity.subjectId, "user_2aBcDeFg");
  assert.equal(identity.namespace, "org_default");
  assert.equal(identity.email, "alice@example.com");
});

test("Types - AccountKey includes identity, chainId, impl version, and signerKeyId", () => {
  const accountKey: AccountKey = {
    identity: {
      provider: "clerk",
      subjectId: "user_2aBcDeFg",
    },
    chainId: 31337,
    accountImplementationVersion: "1.0.0",
    signerKeyId: "key_webcrypto_f1a2b3",
  };

  assert.equal(accountKey.chainId, 31337);
  assert.equal(accountKey.accountImplementationVersion, "1.0.0");
  assert.equal(accountKey.signerKeyId, "key_webcrypto_f1a2b3");
  assert.equal(accountKey.identity.subjectId, "user_2aBcDeFg");
});

test("Types - TransactionIntent and Receipt type shapes", () => {
  const intent: TransactionIntent = {
    to: "0x1111111111111111111111111111111111111111",
    value: 1000000000000000n,
    data: "0xdeadbeef",
  };
  assert.equal(intent.to, "0x1111111111111111111111111111111111111111");

  const receipt: Receipt = {
    transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    blockNumber: 42n,
    success: true,
    gasUsed: 21000n,
  };
  assert.equal(receipt.success, true);
  assert.equal(receipt.blockNumber, 42n);
});

test("Types - IdentityResolver interface contract", async () => {
  class MockResolver implements IdentityResolver {
    async resolve(): Promise<AppIdentity> {
      return {
        provider: "clerk",
        subjectId: "user_test",
      };
    }
  }

  const resolver = new MockResolver();
  const res = await resolver.resolve();
  assert.equal(res.provider, "clerk");
  assert.equal(res.subjectId, "user_test");
});

test("Types - SponsorshipPolicy types (full, conditional, none)", () => {
  const fullPolicy: SponsorshipPolicy = {
    type: "full",
    rateLimit: { maxTransactions: 10, windowSeconds: 60 },
  };
  assert.equal(fullPolicy.type, "full");

  const conditionalPolicy: SponsorshipPolicy = {
    type: "conditional",
    allowlist: {
      contracts: ["0x2222222222222222222222222222222222222222"],
      methods: ["transfer(address,uint256)"],
    },
    fallbackToUnsponsored: false,
  };
  assert.equal(conditionalPolicy.type, "conditional");
  assert.equal(conditionalPolicy.allowlist?.contracts?.length, 1);

  const nonePolicy: SponsorshipPolicy = { type: "none" };
  assert.equal(nonePolicy.type, "none");
});
