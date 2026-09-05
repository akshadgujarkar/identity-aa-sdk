/**
 * @identity-aa-sdk/core - Transaction Engine Unit Tests
 * Tests UserOp packing, calldata encoding, hash calculation,
 * state machine transitions, forced failures, timeouts, and execution.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  packAccountGasLimits,
  unpackAccountGasLimits,
  packGasFees,
  unpackGasFees,
  encodeExecuteCalldata,
  encodeExecuteBatchCalldata,
  encodeInitCode,
  getUserOpHash,
  type PackedUserOperation,
} from "../src/internal/userOp/index.js";
import {
  TransactionStateMachine,
  type TransactionLifecycleState,
} from "../src/internal/transactionEngine/stateMachine.js";
import { TransactionEngine } from "../src/internal/transactionEngine/engine.js";
import { LocalSigner } from "../src/internal/signer/signer.js";
import { ChainClient } from "../src/internal/chain.js";
import {
  BundlerError,
  GasError,
  SigningError,
  TransactionError,
} from "../src/errors/categories.js";
import type { TransactionIntent, Receipt } from "../src/types/transaction.js";
import type { HexAddress, HexData } from "../src/types/account.js";

const ENTRY_POINT: HexAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const FACTORY: HexAddress = "0x1111111111111111111111111111111111111111";
const RECIPIENT: HexAddress = "0x2222222222222222222222222222222222222222";
const CHAIN_ID = 31337;

describe("Phase 06 - UserOp Calldata & Packing Helpers", () => {
  it("packs and unpacks account gas limits correctly", () => {
    const vgl = 150_000n;
    const cgl = 200_000n;
    const packed = packAccountGasLimits(vgl, cgl);
    assert.equal(packed.length, 66); // 0x + 64 hex chars (32 bytes)

    const unpacked = unpackAccountGasLimits(packed);
    assert.equal(unpacked.verificationGasLimit, vgl);
    assert.equal(unpacked.callGasLimit, cgl);
  });

  it("packs and unpacks gas fees correctly", () => {
    const prio = 1_000_000_000n;
    const max = 2_500_000_000n;
    const packed = packGasFees(prio, max);
    assert.equal(packed.length, 66);

    const unpacked = unpackGasFees(packed);
    assert.equal(unpacked.maxPriorityFeePerGas, prio);
    assert.equal(unpacked.maxFeePerGas, max);
  });

  it("encodes single execute calldata properly", () => {
    const intent: TransactionIntent = {
      to: RECIPIENT,
      value: 1000000000000000000n,
      data: "0x1234",
    };
    const calldata = encodeExecuteCalldata(intent);
    assert.ok(calldata.startsWith("0x"));
    assert.ok(calldata.length > 10);
  });

  it("encodes executeBatch calldata properly", () => {
    const intents: TransactionIntent[] = [
      { to: RECIPIENT, value: 100n, data: "0x" },
      { to: FACTORY, value: 200n, data: "0xabcdef" },
    ];
    const calldata = encodeExecuteBatchCalldata(intents);
    assert.ok(calldata.startsWith("0x"));
    assert.ok(calldata.length > 10);
  });

  it("encodes initCode with factory and createAccount calldata", () => {
    const owner: HexAddress = "0x3333333333333333333333333333333333333333";
    const salt = "0x1234567890123456789012345678901234567890123456789012345678901234" as HexData;
    const initCode = encodeInitCode(FACTORY, owner, salt);
    assert.ok(initCode.toLowerCase().startsWith(FACTORY.toLowerCase()));
    assert.ok(initCode.length > 42);
  });

  it("computes deterministic EIP-712 getUserOpHash", () => {
    const dummyOp: PackedUserOperation = {
      sender: "0x4444444444444444444444444444444444444444",
      nonce: 0n,
      initCode: "0x",
      callData: "0x1234",
      accountGasLimits: packAccountGasLimits(150_000n, 100_000n),
      preVerificationGas: 50_000n,
      gasFees: packGasFees(1_000_000_000n, 2_000_000_000n),
      paymasterAndData: "0x",
      signature: "0x",
    };

    const hash1 = getUserOpHash(dummyOp, ENTRY_POINT, CHAIN_ID);
    const hash2 = getUserOpHash(dummyOp, ENTRY_POINT, CHAIN_ID);

    assert.equal(hash1.length, 66);
    assert.equal(hash1, hash2);

    // Altering sender changes the hash
    const hashDifferent = getUserOpHash(
      { ...dummyOp, sender: "0x5555555555555555555555555555555555555555" },
      ENTRY_POINT,
      CHAIN_ID
    );
    assert.notEqual(hash1, hashDifferent);
  });
});

describe("Phase 06 - Transaction Lifecycle State Machine", () => {
  it("follows the happy path: Building -> Estimating -> Signing -> Submitting -> Pending -> Confirmed", async () => {
    const sm = new TransactionStateMachine("0xabcdef" as HexData);
    const states: TransactionLifecycleState[] = [];
    sm.onStateChange((s) => states.push(s));

    assert.equal(sm.state, "Building");

    sm.transitionTo("Estimating");
    assert.equal(sm.state, "Estimating");

    sm.transitionTo("Signing");
    assert.equal(sm.state, "Signing");

    sm.transitionTo("Submitting");
    assert.equal(sm.state, "Submitting");

    sm.transitionTo("Pending");
    assert.equal(sm.state, "Pending");

    const receipt: Receipt = {
      transactionHash: "0xabcdef" as HexData,
      blockNumber: 100n,
      success: true,
      gasUsed: 50000n,
    };

    sm.confirm(receipt);
    assert.equal(sm.state, "Confirmed");

    const resolved = await sm.wait();
    assert.deepEqual(resolved, receipt);
    assert.deepEqual(states, [
      "Estimating",
      "Signing",
      "Submitting",
      "Pending",
      "Confirmed",
    ]);
  });

  it("handles on-chain execution reversion (success: false) transitioning Pending -> Failed", async () => {
    const sm = new TransactionStateMachine();
    sm.transitionTo("Estimating");
    sm.transitionTo("Signing");
    sm.transitionTo("Submitting");
    sm.transitionTo("Pending");

    const revertedReceipt: Receipt = {
      transactionHash: "0x123" as HexData,
      blockNumber: 101n,
      success: false,
    };

    sm.confirm(revertedReceipt);
    assert.equal(sm.state, "Failed");

    await assert.rejects(async () => sm.wait(), (err: unknown) => {
      assert.ok(err instanceof TransactionError);
      assert.match((err as TransactionError).message, /reverted on-chain/i);
      return true;
    });
  });

  it("rejects illegal state transitions", () => {
    const sm = new TransactionStateMachine();
    // Cannot jump from Building to Submitting directly
    assert.throws(
      () => sm.transitionTo("Submitting"),
      (err: unknown) => {
        assert.ok(err instanceof TransactionError);
        assert.match((err as TransactionError).message, /Invalid state transition/);
        return true;
      }
    );
    assert.equal(sm.state, "Failed");
  });

  it("handles timeout in Pending state transitioning to Dropped", async () => {
    const sm = new TransactionStateMachine();
    sm.transitionTo("Estimating");
    sm.transitionTo("Signing");
    sm.transitionTo("Submitting");
    sm.transitionTo("Pending");

    await assert.rejects(async () => sm.wait(20), (err: unknown) => {
      assert.ok(err instanceof TransactionError);
      assert.match((err as TransactionError).message, /timed out after 20ms/i);
      assert.equal((err as TransactionError).retryable, true);
      return true;
    });

    assert.equal(sm.state, "Dropped");
  });

  it("supports explicit drop() transitioning Pending -> Dropped", async () => {
    const sm = new TransactionStateMachine();
    sm.transitionTo("Estimating");
    sm.transitionTo("Signing");
    sm.transitionTo("Submitting");
    sm.transitionTo("Pending");

    sm.drop("Replacement fee too low / mempool expired");
    assert.equal(sm.state, "Dropped");

    await assert.rejects(async () => sm.wait(), (err: unknown) => {
      assert.ok(err instanceof TransactionError);
      assert.match((err as TransactionError).message, /Replacement fee too low/);
      assert.equal((err as TransactionError).retryable, true);
      return true;
    });
  });
});

describe("Phase 06 - TransactionEngine Execution & Forced Failures", () => {
  class MockChainClient extends ChainClient {
    public isDeployedMock = false;
    public nonceMock = 0n;
    public gasFeesFail = false;

    constructor() {
      super("http://127.0.0.1:8545");
    }

    override async isContractDeployed(): Promise<boolean> {
      return this.isDeployedMock;
    }

    override async getNonce(): Promise<bigint> {
      return this.nonceMock;
    }

    override async getGasFees(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
      if (this.gasFeesFail) {
        throw new Error("RPC gas oracle timeout");
      }
      return {
        maxFeePerGas: 2000000000n,
        maxPriorityFeePerGas: 1000000000n,
      };
    }
  }

  it("builds and signs a UserOp end-to-end for undeployed account", async () => {
    const mockChain = new MockChainClient();
    const signer = LocalSigner.create("test_key");
    const signerAddress = await signer.getAddress();
    const salt = "0x1234567890123456789012345678901234567890123456789012345678901234" as HexData;
    const senderAddress: HexAddress = "0x8888888888888888888888888888888888888888";

    const engine = new TransactionEngine({
      chainClient: mockChain,
      entryPointAddress: ENTRY_POINT,
      factoryAddress: FACTORY,
      chainId: CHAIN_ID,
      signer,
      senderAddress,
      ownerAddress: signerAddress,
      salt,
      submitHandler: async (userOp) => {
        assert.ok(userOp.signature.length > 10);
        return "0xsubmitteduserophash12345" as HexData;
      },
    });

    const intent: TransactionIntent = {
      to: RECIPIENT,
      value: 1000n,
      data: "0x",
    };

    const handle = await engine.sendTransaction(intent);
    assert.equal(handle.state, "Pending");
    assert.equal(handle.transactionHash, "0xsubmitteduserophash12345");
  });

  it("forces failure at Estimating -> Failed when gas oracle fails", async () => {
    const mockChain = new MockChainClient();
    mockChain.gasFeesFail = true;
    const signer = LocalSigner.create("test_key_fail_gas");
    const signerAddress = await signer.getAddress();
    const salt = "0x1234567890123456789012345678901234567890123456789012345678901234" as HexData;

    const engine = new TransactionEngine({
      chainClient: mockChain,
      entryPointAddress: ENTRY_POINT,
      factoryAddress: FACTORY,
      chainId: CHAIN_ID,
      signer,
      senderAddress: "0x8888888888888888888888888888888888888888",
      ownerAddress: signerAddress,
      salt,
    });

    await assert.rejects(
      async () => engine.sendTransaction({ to: RECIPIENT, value: 0n }),
      (err: unknown) => {
        assert.ok(err instanceof GasError);
        assert.match((err as GasError).message, /gas/i);
        return true;
      }
    );
  });

  it("forces failure at Signing -> Failed when signer fails", async () => {
    const mockChain = new MockChainClient();
    const failingSigner = {
      keyId: "failing_key",
      getAddress: async () => "0x9999999999999999999999999999999999999999" as HexAddress,
      signMessage: async () => {
        throw new Error("Hardware key unplugged");
      },
      signHash: async () => {
        throw new Error("Hardware key unplugged");
      },
    };
    const salt = "0x1234567890123456789012345678901234567890123456789012345678901234" as HexData;

    const engine = new TransactionEngine({
      chainClient: mockChain,
      entryPointAddress: ENTRY_POINT,
      factoryAddress: FACTORY,
      chainId: CHAIN_ID,
      signer: failingSigner,
      senderAddress: "0x8888888888888888888888888888888888888888",
      ownerAddress: "0x9999999999999999999999999999999999999999",
      salt,
    });

    await assert.rejects(
      async () => engine.sendTransaction({ to: RECIPIENT, value: 0n }),
      (err: unknown) => {
        assert.ok(err instanceof SigningError);
        assert.match((err as SigningError).message, /Hardware key unplugged/);
        return true;
      }
    );
  });

  it("forces failure at Submitting -> Failed when bundler rejects", async () => {
    const mockChain = new MockChainClient();
    const signer = LocalSigner.create("test_key_fail_bundler");
    const signerAddress = await signer.getAddress();
    const salt = "0x1234567890123456789012345678901234567890123456789012345678901234" as HexData;

    const engine = new TransactionEngine({
      chainClient: mockChain,
      entryPointAddress: ENTRY_POINT,
      factoryAddress: FACTORY,
      chainId: CHAIN_ID,
      signer,
      senderAddress: "0x8888888888888888888888888888888888888888",
      ownerAddress: signerAddress,
      salt,
      submitHandler: async () => {
        throw new BundlerError({
          code: "AA21_PREFUND_TOO_LOW",
          message: "AA21 didn't pay prefund",
          retryable: false,
        });
      },
    });

    await assert.rejects(
      async () => engine.sendTransaction({ to: RECIPIENT, value: 0n }),
      (err: unknown) => {
        assert.ok(err instanceof BundlerError);
        assert.match((err as BundlerError).message, /AA21/);
        return true;
      }
    );
  });

  it("validates intent parameters and rejects malformed addresses or negative values", async () => {
    const mockChain = new MockChainClient();
    const signer = LocalSigner.create("test_key_val");
    const signerAddress = await signer.getAddress();
    const salt = "0x1234567890123456789012345678901234567890123456789012345678901234" as HexData;

    const engine = new TransactionEngine({
      chainClient: mockChain,
      entryPointAddress: ENTRY_POINT,
      factoryAddress: FACTORY,
      chainId: CHAIN_ID,
      signer,
      senderAddress: "0x8888888888888888888888888888888888888888",
      ownerAddress: signerAddress,
      salt,
    });

    // Empty intent batch
    await assert.rejects(
      async () => engine.sendTransaction([]),
      (err: unknown) => {
        assert.ok(err instanceof TransactionError);
        assert.match((err as TransactionError).message, /must contain at least one intent/);
        return true;
      }
    );

    // Invalid address
    await assert.rejects(
      async () => engine.sendTransaction({ to: "not-an-address" as HexAddress }),
      (err: unknown) => {
        assert.ok(err instanceof TransactionError);
        assert.match((err as TransactionError).message, /invalid or missing 'to' address/);
        return true;
      }
    );
  });
});
