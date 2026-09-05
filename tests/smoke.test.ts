import { spawn, ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// 1. Verify workspace imports
import { DEFAULT_LOCAL_NETWORK, SDKConfig, AppIdentity } from "@identity-aa-sdk/core";
import { ClerkIdentityResolver } from "@identity-aa-sdk/clerk";
import { useSmartAccount } from "@identity-aa-sdk/react";
import { getDemoConfig } from "@identity-aa-sdk/demo";

async function rpcCall(url: string, method: string, params: unknown[] = []): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`RPC HTTP error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json() as any;
  if (data.error) {
    throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

function findAnvilPath(): string {
  const customPath = join(homedir(), ".foundry", "bin", process.platform === "win32" ? "anvil.exe" : "anvil");
  if (existsSync(customPath)) {
    return customPath;
  }
  return "anvil";
}

async function isChainReachable(rpcUrl: string): Promise<boolean> {
  try {
    const chainIdHex = await rpcCall(rpcUrl, "eth_chainId");
    return typeof chainIdHex === "string";
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== Phase 0 Smoke Test ===");
  console.log("1. Checking workspace packages resolution...");

  // Verify core
  console.log("  - @identity-aa-sdk/core loaded. Default chainId:", DEFAULT_LOCAL_NETWORK.chainId);
  if (DEFAULT_LOCAL_NETWORK.chainId !== 31337) {
    throw new Error(`Unexpected default local chainId: ${DEFAULT_LOCAL_NETWORK.chainId}`);
  }
  if (!DEFAULT_LOCAL_NETWORK.entryPointAddress.startsWith("0x")) {
    throw new Error(`Invalid EntryPoint address format: ${DEFAULT_LOCAL_NETWORK.entryPointAddress}`);
  }

  // Verify clerk adapter
  const mockResolver = new ClerkIdentityResolver(() => ({
    id: "sess_123",
    user: { id: "user_123", primaryEmailAddress: { emailAddress: "test@example.com" } },
  }));
  const resolvedIdentity = await mockResolver.resolve();
  console.log("  - @identity-aa-sdk/clerk loaded. Resolved identity subjectId:", resolvedIdentity.subjectId);
  if (resolvedIdentity.subjectId !== "user_123") {
    throw new Error("Clerk resolver failed to resolve mock user");
  }

  // Verify react
  console.log("  - @identity-aa-sdk/react loaded. SmartAccount hook defined:", typeof useSmartAccount === "function");
  if (typeof useSmartAccount !== "function") {
    throw new Error("@identity-aa-sdk/react did not export useSmartAccount hook");
  }

  // Verify demo
  const demoConfig = getDemoConfig();
  console.log("  - @identity-aa-sdk/demo loaded. Config chainId:", demoConfig.network.chainId);

  console.log("\n2. Checking Local Chain (Anvil) connectivity...");
  const rpcUrl = DEFAULT_LOCAL_NETWORK.rpcUrl;
  let anvilProc: ChildProcess | null = null;

  const alreadyRunning = await isChainReachable(rpcUrl);
  if (alreadyRunning) {
    console.log(`  - Local chain is already reachable at ${rpcUrl}`);
  } else {
    console.log(`  - Spawning temporary Anvil instance on ${rpcUrl}...`);
    const anvilBin = findAnvilPath();
    anvilProc = spawn(anvilBin, ["--port", "8545", "--chain-id", "31337"], {
      stdio: "ignore",
    });

    // Wait for chain to come up (retry for 5 seconds)
    let ready = false;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (await isChainReachable(rpcUrl)) {
        ready = true;
        break;
      }
    }

    if (!ready) {
      if (anvilProc) anvilProc.kill();
      throw new Error(`Failed to reach local Anvil chain at ${rpcUrl}`);
    }
    console.log(`  - Anvil node started successfully!`);
  }

  try {
    const chainIdHex = await rpcCall(rpcUrl, "eth_chainId");
    const chainId = parseInt(chainIdHex, 16);
    console.log(`  - JSON-RPC eth_chainId: ${chainId} (hex: ${chainIdHex})`);
    if (chainId !== 31337) {
      throw new Error(`Expected chainId 31337, got ${chainId}`);
    }

    const blockNumberHex = await rpcCall(rpcUrl, "eth_blockNumber");
    const blockNumber = parseInt(blockNumberHex, 16);
    console.log(`  - JSON-RPC eth_blockNumber: ${blockNumber}`);

    console.log("\n[PASS] All Phase 0 acceptance criteria verified successfully!");
  } finally {
    if (anvilProc) {
      console.log("  - Stopping temporary Anvil process...");
      anvilProc.kill();
    }
  }
}

main().catch((err) => {
  console.error("\n[FAIL] Smoke test failed:", err);
  process.exit(1);
});
