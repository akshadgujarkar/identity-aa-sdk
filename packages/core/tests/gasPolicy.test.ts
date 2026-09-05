/**
 * @identity-aa-sdk/core - Gas Policy & Paymaster Client Unit Tests
 * Tests sponsorship policies, allowlists, rate limits, spend caps,
 * paymasterAndData wire packing, and TransactionEngine sponsorship integration.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GasPolicyManager,
  PaymasterClient,
  packPaymasterAndData,
  unpackPaymasterAndData,
} from "../src/index.js";
import { SponsorshipError } from "../src/errors/categories.js";
import { TransactionEngine } from "../src/internal/transactionEngine/engine.js";
import { LocalSigner } from "../src/internal/signer/signer.js";
import { ChainClient } from "../src/internal/chain.js";
import { createIdentityAASDK } from "../src/sdk.js";
import type { HexAddress, HexData } from "../src/types/account.js";
import type { TransactionIntent } from "../src/types/transaction.js";
import type { SponsorshipPolicy } from "../src/types/sponsorship.js";

const DUMMY_ENTRY_POINT: HexAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const DUMMY_PAYMASTER: HexAddress = "0x1111111111111111111111111111111111111111";
const DUMMY_TARGET: HexAddress = "0x2222222222222222222222222222222222222222";
const UNALLOWED_TARGET: HexAddress = "0x3333333333333333333333333333333333333333";
const DUMMY_SENDER: HexAddress = "0x4444444444444444444444444444444444444444";

describe("Phase 08 - Paymaster Encoding & Packing", () => {
  it("packs and unpacks ERC-4337 v0.7 paymasterAndData correctly", () => {
    const vgl = 100_000n;
    const pgl = 50_000n;
    const customData = "0xabcdef12";

    const packed = packPaymasterAndData(DUMMY_PAYMASTER, vgl, pgl, customData);
    assert.ok(packed.startsWith("0x"));
    // 20 bytes (addr) + 16 bytes (vgl) + 16 bytes (pgl) + 4 bytes (data) = 56 bytes (0x + 112 hex chars)
    assert.equal(packed.length, 2 + 40 + 32 + 32 + 8);

    const unpacked = unpackPaymasterAndData(packed);
    assert.equal(unpacked.paymaster.toLowerCase(), DUMMY_PAYMASTER.toLowerCase());
    assert.equal(unpacked.paymasterVerificationGasLimit, vgl);
    assert.equal(unpacked.paymasterPostOpGasLimit, pgl);
    assert.equal(unpacked.paymasterData.toLowerCase(), customData.toLowerCase());
  });

  it("throws on invalid paymaster address or corrupted length", () => {
    assert.throws(
      () => packPaymasterAndData("invalid-address" as HexAddress, 100n, 100n),
      (err: unknown) => {
        assert.ok(err instanceof SponsorshipError);
        assert.equal((err as SponsorshipError).code, "INVALID_PAYMASTER_ADDRESS");
        return true;
      }
    );

    assert.throws(
      () => unpackPaymasterAndData("0x1234" as HexData),
      (err: unknown) => {
        assert.ok(err instanceof SponsorshipError);
        assert.equal((err as SponsorshipError).code, "INVALID_PAYMASTER_DATA_LENGTH");
        return true;
      }
    );
  });
});

describe("Phase 08 - Gas Policy Manager Evaluation", () => {
  it("approves full sponsorship unconditionally", () => {
    const manager = new GasPolicyManager({ type: "full" });
    const decision = manager.evaluateSponsorship([
      { to: DUMMY_TARGET, value: 0n, data: "0x12345678" },
    ]);
    assert.equal(decision.approved, true);
  });

  it("denies sponsorship when type is 'none'", () => {
    const manager = new GasPolicyManager({ type: "none" });
    const decision = manager.evaluateSponsorship([
      { to: DUMMY_TARGET, value: 0n, data: "0x12345678" },
    ]);
    assert.equal(decision.approved, false);
  });

  it("enforces contract address allowlists for conditional policy", () => {
    const policy: SponsorshipPolicy = {
      type: "conditional",
      allowlist: {
        contracts: [DUMMY_TARGET],
      },
    };
    const manager = new GasPolicyManager(policy);

    // Allowed target
    const allowed = manager.evaluateSponsorship([{ to: DUMMY_TARGET, value: 0n }]);
    assert.equal(allowed.approved, true);

    // Unallowed target without fallback
    assert.throws(
      () => manager.evaluateSponsorship([{ to: UNALLOWED_TARGET, value: 0n }]),
      (err: unknown) => {
        assert.ok(err instanceof SponsorshipError);
        assert.equal((err as SponsorshipError).code, "TARGET_NOT_ALLOWLISTED");
        return true;
      }
    );

    // Unallowed target with fallback
    const fallbackManager = new GasPolicyManager({
      ...policy,
      fallbackToUnsponsored: true,
    });
    const fallbackDecision = fallbackManager.evaluateSponsorship([{ to: UNALLOWED_TARGET, value: 0n }]);
    assert.equal(fallbackDecision.approved, false);
    assert.equal(fallbackDecision.fallbackToUnsponsored, true);
  });

  it("enforces 4-byte method selector allowlists for conditional policy", () => {
    const policy: SponsorshipPolicy = {
      type: "conditional",
      allowlist: {
        methods: ["0xa9059cbb"], // ERC-20 transfer(address,uint256)
      },
    };
    const manager = new GasPolicyManager(policy);

    // Allowed method
    const allowed = manager.evaluateSponsorship([
      { to: DUMMY_TARGET, value: 0n, data: "0xa9059cbb00000000000000000000000012345678" },
    ]);
    assert.equal(allowed.approved, true);

    // Unallowed method
    assert.throws(
      () =>
        manager.evaluateSponsorship([
          { to: DUMMY_TARGET, value: 0n, data: "0xdeadbeef1234" },
        ]),
      (err: unknown) => {
        assert.ok(err instanceof SponsorshipError);
        assert.equal((err as SponsorshipError).code, "METHOD_NOT_ALLOWLISTED");
        return true;
      }
    );
  });

  it("enforces per-user rate limits across sliding time windows", () => {
    const manager = new GasPolicyManager({
      type: "full",
      rateLimit: {
        maxTransactions: 2,
        windowSeconds: 60,
      },
    });

    const intent: TransactionIntent = { to: DUMMY_TARGET, value: 0n };

    // 1st & 2nd succeed
    assert.equal(manager.evaluateSponsorship([intent], "user_alice").approved, true);
    assert.equal(manager.evaluateSponsorship([intent], "user_alice").approved, true);

    // 3rd fails with RATE_LIMIT_EXCEEDED
    assert.throws(
      () => manager.evaluateSponsorship([intent], "user_alice"),
      (err: unknown) => {
        assert.ok(err instanceof SponsorshipError);
        assert.equal((err as SponsorshipError).code, "RATE_LIMIT_EXCEEDED");
        return true;
      }
    );

    // Different user is not blocked
    assert.equal(manager.evaluateSponsorship([intent], "user_bob").approved, true);
  });

  it("enforces spend cap policies", () => {
    const manager = new GasPolicyManager({
      type: "full",
      spendCap: {
        maxGasWei: 1_000_000n,
        periodSeconds: 3600,
      },
    });

    const intent: TransactionIntent = { to: DUMMY_TARGET, value: 0n };

    // Under cap
    assert.equal(manager.evaluateSponsorship([intent], "user_1", 400_000n).approved, true);
    assert.equal(manager.evaluateSponsorship([intent], "user_1", 400_000n).approved, true);

    // Exceeds cap (800_000 + 300_000 > 1_000_000)
    assert.throws(
      () => manager.evaluateSponsorship([intent], "user_1", 300_000n),
      (err: unknown) => {
        assert.ok(err instanceof SponsorshipError);
        assert.equal((err as SponsorshipError).code, "SPEND_CAP_EXCEEDED");
        return true;
      }
    );
  });

  it("fails closed in production mode when policy is missing", () => {
    const manager = new GasPolicyManager(undefined, "production");
    assert.throws(
      () => manager.evaluateSponsorship([{ to: DUMMY_TARGET, value: 0n }]),
      (err: unknown) => {
        assert.ok(err instanceof SponsorshipError);
        assert.equal(
          (err as SponsorshipError).code,
          "MISSING_PRODUCTION_SPONSORSHIP_POLICY"
        );
        return true;
      }
    );
  });
});

describe("Phase 08 - TransactionEngine Sponsored Execution", () => {
  class MockChainClient extends ChainClient {
    constructor() {
      super("http://127.0.0.1:8545");
    }
    override async isContractDeployed(): Promise<boolean> {
      return true;
    }
    override async getNonce(): Promise<bigint> {
      return 0n;
    }
    override async getGasFees(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
      return { maxFeePerGas: 2000000000n, maxPriorityFeePerGas: 1000000000n };
    }
  }

  it("attaches paymasterAndData when sponsorship is approved", async () => {
    const mockChain = new MockChainClient();
    const signer = LocalSigner.create("test_key_phase08");
    const signerAddress = await signer.getAddress();
    const salt = "0x1234567890123456789012345678901234567890123456789012345678901234" as HexData;

    let submittedUserOp: any;
    const engine = new TransactionEngine({
      chainClient: mockChain,
      entryPointAddress: DUMMY_ENTRY_POINT,
      chainId: 31337,
      signer,
      senderAddress: DUMMY_SENDER,
      ownerAddress: signerAddress,
      salt,
      paymasterAddress: DUMMY_PAYMASTER,
      gasPolicyManager: new GasPolicyManager({ type: "full" }),
      submitHandler: async (userOp) => {
        submittedUserOp = userOp;
        return "0xsubmitteduserophash" as HexData;
      },
    });

    const handle = await engine.sendTransaction({
      to: DUMMY_TARGET,
      value: 0n,
    });

    assert.equal(handle.state, "Pending");
    assert.ok(submittedUserOp);
    assert.ok(submittedUserOp.paymasterAndData.toLowerCase().startsWith(DUMMY_PAYMASTER.toLowerCase()));

    const unpacked = unpackPaymasterAndData(submittedUserOp.paymasterAndData);
    assert.equal(unpacked.paymaster.toLowerCase(), DUMMY_PAYMASTER.toLowerCase());
    assert.equal(unpacked.paymasterVerificationGasLimit, 100_000n);
    assert.equal(unpacked.paymasterPostOpGasLimit, 50_000n);
  });

  it("fails closed when sponsorship is denied by policy", async () => {
    const mockChain = new MockChainClient();
    const signer = LocalSigner.create("test_key_phase08_deny");
    const signerAddress = await signer.getAddress();
    const salt = "0x1234567890123456789012345678901234567890123456789012345678901234" as HexData;

    const engine = new TransactionEngine({
      chainClient: mockChain,
      entryPointAddress: DUMMY_ENTRY_POINT,
      chainId: 31337,
      signer,
      senderAddress: DUMMY_SENDER,
      ownerAddress: signerAddress,
      salt,
      paymasterAddress: DUMMY_PAYMASTER,
      gasPolicyManager: new GasPolicyManager({
        type: "conditional",
        allowlist: { contracts: [DUMMY_TARGET] },
      }),
    });

    await assert.rejects(
      async () => engine.sendTransaction({ to: UNALLOWED_TARGET, value: 0n }),
      (err: unknown) => {
        assert.ok(err instanceof SponsorshipError);
        assert.equal((err as SponsorshipError).code, "TARGET_NOT_ALLOWLISTED");
        return true;
      }
    );
  });

  it("updates policy dynamically via sdk.configure()", async () => {
    const sdk = createIdentityAASDK({
      config: {
        environment: "development",
        network: {
          chainId: 31337,
          rpcUrl: "http://127.0.0.1:8545",
          entryPointAddress: DUMMY_ENTRY_POINT,
          paymasterAddress: DUMMY_PAYMASTER,
        },
        sponsorship: { type: "none" },
      },
      resolver: {
        provider: "clerk",
        resolve: async () => ({ provider: "clerk", subjectId: "user_test" }),
      },
    });

    assert.equal(sdk.config.sponsorship?.type, "none");

    sdk.configure({ sponsorship: { type: "full" } });
    assert.equal(sdk.config.sponsorship?.type, "full");
  });
});
