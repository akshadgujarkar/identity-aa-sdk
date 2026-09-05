/**
 * @identity-aa-sdk/core - Bundler Client & Error Translation Tests
 * Tests ERC-4337 JSON-RPC operations, wire encoding, AA## error mappings,
 * receipt polling, and integration with the Transaction Engine.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BundlerClient,
  serializeUserOpToRpc,
  translateBundlerError,
  extractAACode,
} from "../src/internal/bundler/index.js";
import {
  BundlerError,
  GasError,
  NetworkError,
  SigningError,
  SponsorshipError,
  TransactionError,
} from "../src/errors/categories.js";
import { packAccountGasLimits, packGasFees, type PackedUserOperation } from "../src/internal/userOp/types.js";
import { TransactionEngine } from "../src/internal/transactionEngine/engine.js";
import { LocalSigner } from "../src/internal/signer/signer.js";
import { ChainClient } from "../src/internal/chain.js";
import type { HexAddress, HexData } from "../src/types/account.js";

const DUMMY_ENTRY_POINT: HexAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const DUMMY_SENDER: HexAddress = "0x8888888888888888888888888888888888888888";
const DUMMY_RECIPIENT: HexAddress = "0x9999999999999999999999999999999999999999";

function createDummyUserOp(): PackedUserOperation {
  return {
    sender: DUMMY_SENDER,
    nonce: 1n,
    initCode: "0x",
    callData: "0x1234",
    accountGasLimits: packAccountGasLimits(150_000n, 100_000n),
    preVerificationGas: 50_000n,
    gasFees: packGasFees(1_000_000_000n, 2_000_000_000n),
    paymasterAndData: "0x",
    signature: "0x" + "00".repeat(65),
  };
}

describe("Phase 07 - Bundler Serialization & RPC Wire Format", () => {
  it("serializes PackedUserOperation to JSON-RPC wire format with hex string fields", () => {
    const userOp = createDummyUserOp();
    const wire = serializeUserOpToRpc(userOp);

    assert.equal(wire.sender, DUMMY_SENDER);
    assert.equal(wire.nonce, "0x1");
    assert.equal(wire.initCode, "0x");
    assert.equal(wire.callData, "0x1234");
    assert.equal(wire.preVerificationGas, "0xc350"); // 50000 in hex
    assert.ok(wire.accountGasLimits.startsWith("0x"));
    assert.ok(wire.gasFees.startsWith("0x"));
  });
});

describe("Phase 07 - AA## Code Extraction & Error Translation", () => {
  it("extracts AA## code from error message and data", () => {
    assert.equal(extractAACode("AA21 prefund too low"), "AA21");
    assert.equal(extractAACode("Reverted with AA23 in validation"), "AA23");
    assert.equal(extractAACode("Unknown error", "Failed with AA33"), "AA33");
    assert.equal(extractAACode("Standard error without code"), undefined);
  });

  it("translates AA21 into BundlerError with AA21_PREFUND_TOO_LOW", () => {
    const raw = { message: "AA21 didn't pay prefund" };
    const err = translateBundlerError(raw);
    assert.ok(err instanceof BundlerError);
    assert.equal(err.code, "AA21_PREFUND_TOO_LOW");
    assert.equal(err.causeCode, "AA21");
    assert.equal(err.retryable, false);
  });

  it("translates AA23 into BundlerError with AA23_REVERTED_IN_VALIDATION", () => {
    const raw = { message: "AA23 reverted in validation during simulation" };
    const err = translateBundlerError(raw);
    assert.ok(err instanceof BundlerError);
    assert.equal(err.code, "AA23_REVERTED_IN_VALIDATION");
    assert.equal(err.causeCode, "AA23");
    assert.equal(err.retryable, false);
  });

  it("translates AA24 into SigningError with AA24_INVALID_SIGNATURE", () => {
    const raw = { message: "AA24 signature error" };
    const err = translateBundlerError(raw);
    assert.ok(err instanceof SigningError);
    assert.equal(err.code, "AA24_INVALID_SIGNATURE");
    assert.equal(err.causeCode, "AA24");
    assert.equal(err.retryable, false);
  });

  it("translates AA31 and AA33 into SponsorshipError", () => {
    const raw31 = { message: "AA31 paymaster deposit too low" };
    const err31 = translateBundlerError(raw31);
    assert.ok(err31 instanceof SponsorshipError);
    assert.equal(err31.code, "AA31_PAYMASTER_DEPOSIT_TOO_LOW");

    const raw33 = { message: "AA33 paymaster reverted" };
    const err33 = translateBundlerError(raw33);
    assert.ok(err33 instanceof SponsorshipError);
    assert.equal(err33.code, "AA33_PAYMASTER_REVERTED");
  });

  it("translates network/fetch failures into retryable NetworkError", () => {
    const networkErr = new Error("fetch failed: ECONNREFUSED 127.0.0.1:4337");
    const err = translateBundlerError(networkErr);
    assert.ok(err instanceof NetworkError);
    assert.equal(err.code, "BUNDLER_RPC_UNREACHABLE");
    assert.equal(err.retryable, true);
  });
});

describe("Phase 07 - BundlerClient JSON-RPC Operations", () => {
  it("estimates gas limits via eth_estimateUserOperationGas", async () => {
    const mockFetch = async () => {
      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: {
            preVerificationGas: "0x12000",
            verificationGasLimit: "0x35000",
            callGasLimit: "0x40000",
            paymasterVerificationGasLimit: "0x5000",
          },
        }),
      } as any;
    };

    const client = new BundlerClient({
      bundlerUrl: "http://127.0.0.1:4337",
      fetchFn: mockFetch as any,
    });

    const estimates = await client.estimateUserOperationGas(
      createDummyUserOp(),
      DUMMY_ENTRY_POINT
    );

    assert.equal(estimates.preVerificationGas, BigInt("0x12000"));
    assert.equal(estimates.verificationGasLimit, BigInt("0x35000"));
    assert.equal(estimates.callGasLimit, BigInt("0x40000"));
    assert.equal(estimates.paymasterVerificationGasLimit, BigInt("0x5000"));
  });

  it("submits UserOperation via eth_sendUserOperation", async () => {
    const expectedHash: HexData = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const mockFetch = async () => {
      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: expectedHash,
        }),
      } as any;
    };

    const client = new BundlerClient({
      bundlerUrl: "http://127.0.0.1:4337",
      fetchFn: mockFetch as any,
    });

    const hash = await client.sendUserOperation(
      createDummyUserOp(),
      DUMMY_ENTRY_POINT
    );

    assert.equal(hash, expectedHash);
  });

  it("queries and parses UserOperation receipt", async () => {
    const mockFetch = async () => {
      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: {
            userOpHash: "0x1111",
            actualGasUsed: "0x8000",
            success: true,
            receipt: {
              transactionHash: "0xtxhash123",
              blockNumber: "0x64",
              gasUsed: "0x8000",
              status: 1,
            },
          },
        }),
      } as any;
    };

    const client = new BundlerClient({
      bundlerUrl: "http://127.0.0.1:4337",
      fetchFn: mockFetch as any,
    });

    const receipt = await client.getUserOperationReceipt("0x1111" as HexData);
    assert.ok(receipt);
    assert.equal(receipt.transactionHash, "0xtxhash123");
    assert.equal(receipt.blockNumber, 100n);
    assert.equal(receipt.success, true);
    assert.equal(receipt.gasUsed, BigInt("0x8000"));
  });

  it("polls receipt until available and resolves correctly", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return {
        ok: true,
        json: async () => {
          if (callCount < 3) {
            return { jsonrpc: "2.0", id: 1, result: null };
          }
          return {
            jsonrpc: "2.0",
            id: 1,
            result: {
              userOpHash: "0x1111",
              actualGasUsed: "0x5000",
              success: true,
              receipt: {
                transactionHash: "0xtxhashconfirmed",
                blockNumber: "0x7b",
                status: 1,
              },
            },
          };
        },
      } as any;
    };

    const client = new BundlerClient({
      bundlerUrl: "http://127.0.0.1:4337",
      fetchFn: mockFetch as any,
      pollIntervalMs: 10,
    });

    const receipt = await client.pollUserOperationReceipt("0x1111" as HexData, {
      pollIntervalMs: 10,
      timeoutMs: 1000,
    });

    assert.equal(callCount, 3);
    assert.equal(receipt.transactionHash, "0xtxhashconfirmed");
    assert.equal(receipt.blockNumber, 123n);
    assert.equal(receipt.success, true);
  });

  it("throws RECEIPT_POLL_TIMEOUT when polling exceeds timeout", async () => {
    const mockFetch = async () => {
      return {
        ok: true,
        json: async () => ({ jsonrpc: "2.0", id: 1, result: null }),
      } as any;
    };

    const client = new BundlerClient({
      bundlerUrl: "http://127.0.0.1:4337",
      fetchFn: mockFetch as any,
    });

    await assert.rejects(
      async () =>
        client.pollUserOperationReceipt("0x1111" as HexData, {
          pollIntervalMs: 10,
          timeoutMs: 30,
        }),
      (err: unknown) => {
        assert.ok(err instanceof TransactionError);
        assert.equal((err as TransactionError).code, "RECEIPT_POLL_TIMEOUT");
        assert.equal((err as TransactionError).retryable, true);
        return true;
      }
    );
  });

  it("queries supported entrypoints", async () => {
    const mockFetch = async () => {
      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: [DUMMY_ENTRY_POINT],
        }),
      } as any;
    };

    const client = new BundlerClient({
      bundlerUrl: "http://127.0.0.1:4337",
      fetchFn: mockFetch as any,
    });

    const entryPoints = await client.getSupportedEntryPoints();
    assert.deepEqual(entryPoints, [DUMMY_ENTRY_POINT]);
  });
});

describe("Phase 07 - TransactionEngine with BundlerClient Integration", () => {
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

  it("executes end-to-end unsponsored flow with BundlerClient", async () => {
    const mockChain = new MockChainClient();
    const signer = LocalSigner.create("test_key_phase07");
    const signerAddress = await signer.getAddress();
    const salt = "0x1234567890123456789012345678901234567890123456789012345678901234" as HexData;

    let rpcStep = 0;
    const mockFetch = async (url: string, opts: any) => {
      rpcStep++;
      const body = JSON.parse(opts.body);
      if (body.method === "eth_estimateUserOperationGas") {
        return {
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              preVerificationGas: "0xc350",
              verificationGasLimit: "0x249f0",
              callGasLimit: "0x186a0",
            },
          }),
        } as any;
      } else if (body.method === "eth_sendUserOperation") {
        return {
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: body.id,
            result: "0xuserOpHashFromBundler1234",
          }),
        } as any;
      } else if (body.method === "eth_getUserOperationReceipt") {
        return {
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              userOpHash: "0xuserOpHashFromBundler1234",
              actualGasUsed: "0x15000",
              success: true,
              receipt: {
                transactionHash: "0xtxhashConfirmedOnChain",
                blockNumber: "0x10",
                status: 1,
              },
            },
          }),
        } as any;
      }
      throw new Error(`Unhandled method ${body.method}`);
    };

    const bundler = new BundlerClient({
      bundlerUrl: "http://127.0.0.1:4337",
      fetchFn: mockFetch as any,
      pollIntervalMs: 5,
    });

    const engine = new TransactionEngine({
      chainClient: mockChain,
      entryPointAddress: DUMMY_ENTRY_POINT,
      chainId: 31337,
      signer,
      senderAddress: DUMMY_SENDER,
      ownerAddress: signerAddress,
      salt,
      bundlerClient: bundler,
    });

    const handle = await engine.sendTransaction({
      to: DUMMY_RECIPIENT,
      value: 100n,
    });

    assert.equal(handle.state, "Pending");
    assert.equal(handle.transactionHash, "0xuserOpHashFromBundler1234");

    const receipt = await handle.wait();
    assert.equal(receipt.transactionHash, "0xtxhashConfirmedOnChain");
    assert.equal(receipt.success, true);
    assert.equal(handle.state, "Confirmed");
  });
});
