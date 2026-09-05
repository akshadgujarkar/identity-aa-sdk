/**
 * @identity-aa-sdk - Standalone Local ERC-4337 Bundler
 * Listens on http://127.0.0.1:4337, receives UserOperations,
 * and submits real on-chain handleOps transactions to local Anvil.
 */

import http from "node:http";
import {
  createPublicClient,
  createWalletClient,
  http as viemHttp,
  parseAbi,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 4337;
const ANVIL_RPC = "http://127.0.0.1:8545";
const ENTRY_POINT_DEFAULT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

// Anvil dev account #0
const BUNDLER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const bundlerAccount = privateKeyToAccount(BUNDLER_PRIVATE_KEY);

const anvilChain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [ANVIL_RPC] },
  },
});

const publicClient = createPublicClient({
  chain: anvilChain,
  transport: viemHttp(ANVIL_RPC),
});

const walletClient = createWalletClient({
  account: bundlerAccount,
  chain: anvilChain,
  transport: viemHttp(ANVIL_RPC),
});

const ENTRY_POINT_ABI = parseAbi([
  "struct PackedUserOperation { address sender; uint256 nonce; bytes initCode; bytes callData; bytes32 accountGasLimits; uint256 preVerificationGas; bytes32 gasFees; bytes paymasterAndData; bytes signature; }",
  "function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external",
  "function getUserOpHash(PackedUserOperation calldata userOp) external view returns (bytes32)",
]);

interface StoredReceipt {
  userOpHash: string;
  txHash: string;
  sender: string;
  nonce: string;
  blockNumber: string;
  success: boolean;
}

const receipts = new Map<string, StoredReceipt>();

function parseHexOrBigInt(val: unknown): bigint {
  if (typeof val === "bigint") return val;
  if (typeof val === "number") return BigInt(val);
  if (typeof val === "string") {
    if (val.startsWith("0x") || val.startsWith("0X")) return BigInt(val);
    return BigInt(val);
  }
  return 0n;
}

async function handleRpc(body: any): Promise<any> {
  const { method, params, id } = body;

  if (method === "eth_supportedEntryPoints") {
    return {
      jsonrpc: "2.0",
      id,
      result: [ENTRY_POINT_DEFAULT],
    };
  }

  if (method === "eth_estimateUserOperationGas") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        preVerificationGas: "0x186a0", // 100,000
        verificationGasLimit: "0x30d40", // 200,000
        callGasLimit: "0x30d40", // 200,000
        paymasterVerificationGasLimit: "0x186a0", // 100,000
      },
    };
  }

  if (method === "eth_sendUserOperation") {
    const [wireOp, entryPointAddress] = params;
    const epAddress = entryPointAddress || ENTRY_POINT_DEFAULT;

    const packedOp = {
      sender: wireOp.sender as `0x${string}`,
      nonce: parseHexOrBigInt(wireOp.nonce),
      initCode: (wireOp.initCode || "0x") as `0x${string}`,
      callData: (wireOp.callData || "0x") as `0x${string}`,
      accountGasLimits: (wireOp.accountGasLimits ||
        "0x00000000000000000000000000030d4000000000000000000000000000030d40") as `0x${string}`,
      preVerificationGas: parseHexOrBigInt(wireOp.preVerificationGas || "0x186a0"),
      gasFees: (wireOp.gasFees ||
        "0x0000000000000000000000003b9aca0000000000000000000000000077359400") as `0x${string}`,
      paymasterAndData: (wireOp.paymasterAndData || "0x") as `0x${string}`,
      signature: (wireOp.signature || "0x") as `0x${string}`,
    };

    console.log(`\n[Bundler] 📦 Received UserOperation for Sender: ${packedOp.sender}`);
    console.log(`[Bundler]    InitCode Length: ${packedOp.initCode.length} chars (Deploying: ${packedOp.initCode.length > 2})`);
    console.log(`[Bundler]    Submitting handleOps transaction to EntryPoint at ${epAddress}...`);

    try {
      // 1. Submit on-chain transaction calling handleOps on EntryPoint via Anvil
      const txHash = await walletClient.writeContract({
        address: epAddress as `0x${string}`,
        abi: ENTRY_POINT_ABI,
        functionName: "handleOps",
        args: [[packedOp], bundlerAccount.address],
        gas: 3_000_000n,
      });

      console.log(`[Bundler] ⛓️ On-Chain Transaction Mined on Anvil! TxHash: ${txHash}`);

      // 2. Wait for confirmation receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      // 3. Compute deterministic UserOp hash
      let userOpHash = `0x${Buffer.from(txHash.slice(2), "hex").toString("hex")}`;
      try {
        const computed = await publicClient.readContract({
          address: epAddress as `0x${string}`,
          abi: ENTRY_POINT_ABI,
          functionName: "getUserOpHash",
          args: [packedOp],
        });
        userOpHash = computed as string;
      } catch {
        // Fallback to txHash as userOpHash
      }

      receipts.set(userOpHash.toLowerCase(), {
        userOpHash,
        txHash,
        sender: packedOp.sender,
        nonce: `0x${packedOp.nonce.toString(16)}`,
        blockNumber: `0x${receipt.blockNumber.toString(16)}`,
        success: receipt.status === "success",
      });

      // Also map txHash for polling flexibility
      receipts.set(txHash.toLowerCase(), receipts.get(userOpHash.toLowerCase())!);

      console.log(`[Bundler] ✅ UserOp Confirmed in Block #${receipt.blockNumber} (Status: ${receipt.status})\n`);

      return {
        jsonrpc: "2.0",
        id,
        result: userOpHash,
      };
    } catch (err: any) {
      console.error(`[Bundler] ❌ handleOps execution failed on-chain:`, err.message);
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32500,
          message: `handleOps on-chain execution reverted: ${err.message}`,
        },
      };
    }
  }

  if (method === "eth_getUserOperationReceipt") {
    const [targetHash] = params;
    const lookup = receipts.get((targetHash || "").toLowerCase());

    if (!lookup) {
      return {
        jsonrpc: "2.0",
        id,
        result: null,
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      result: {
        userOpHash: lookup.userOpHash,
        entryPoint: ENTRY_POINT_DEFAULT,
        sender: lookup.sender,
        nonce: lookup.nonce,
        actualGasCost: "0x5208",
        actualGasUsed: "0x5208",
        success: lookup.success,
        logs: [],
        receipt: {
          transactionHash: lookup.txHash,
          blockNumber: lookup.blockNumber,
          blockHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
          gasUsed: "0x5208",
          from: bundlerAccount.address,
          status: lookup.success ? "0x1" : "0x0",
          logs: [],
        },
      },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method not implemented: ${method}`,
    },
  };
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST") {
    let rawBody = "";
    req.on("data", (chunk) => {
      rawBody += chunk;
    });

    req.on("end", async () => {
      try {
        const body = JSON.parse(rawBody);
        const response = await handleRpc(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error" },
          })
        );
      }
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ERC-4337 Local Bundler is active on http://127.0.0.1:4337");
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`⚡ ERC-4337 Local Bundler running on http://127.0.0.1:${PORT}`);
  console.log(`🔗 Target Chain: Anvil (${ANVIL_RPC})`);
  console.log(`💼 Bundler Account: ${bundlerAccount.address}`);
  console.log(`=======================================================\n`);
});
