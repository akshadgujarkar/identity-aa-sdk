/**
 * @identity-aa-sdk/core - Chain Client
 * JSON-RPC communication for deployment checks and factory counterfactual address queries.
 */

import {
  createPublicClient,
  http,
  type PublicClient,
  encodeFunctionData,
  decodeFunctionResult,
  parseAbi,
} from "viem";
import type { HexAddress, HexData } from "../types/account.js";
import { NetworkError } from "../errors/categories.js";

const FACTORY_ABI = parseAbi([
  "function getAddress(address owner, bytes32 salt) external view returns (address)",
]);

const ENTRY_POINT_ABI = parseAbi([
  "function getNonce(address sender, uint192 key) external view returns (uint256)",
]);

export class ChainClient {
  private readonly client: PublicClient;

  constructor(rpcUrl: string) {
    try {
      this.client = createPublicClient({
        transport: http(rpcUrl),
      });
    } catch (err: unknown) {
      throw new NetworkError({
        code: "CLIENT_CREATION_FAILED",
        message: "Failed to initialize chain RPC client",
        retryable: true,
        debug: { rpcUrl, error: err instanceof Error ? err.message : String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  get publicClient(): PublicClient {
    return this.client;
  }

  /**
   * Checks if an address has deployed bytecode on-chain.
   */
  async isContractDeployed(address: HexAddress): Promise<boolean> {
    try {
      const code = await this.client.getCode({ address });
      return code !== undefined && code !== "0x" && code.length > 2;
    } catch (err: unknown) {
      throw new NetworkError({
        code: "CODE_QUERY_FAILED",
        message: `Failed to query on-chain bytecode for address ${address}`,
        retryable: true,
        debug: { address, error: err instanceof Error ? err.message : String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Queries the factory contract's getAddress view method.
   */
  async getCounterfactualAddress(
    factoryAddress: HexAddress,
    owner: HexAddress,
    salt: HexData
  ): Promise<HexAddress> {
    try {
      const data = encodeFunctionData({
        abi: FACTORY_ABI,
        functionName: "getAddress",
        args: [owner, salt],
      });

      const result = await this.client.call({
        to: factoryAddress,
        data,
      });

      if (!result.data) {
        throw new Error("No data returned from factory getAddress call");
      }

      const decoded = decodeFunctionResult({
        abi: FACTORY_ABI,
        functionName: "getAddress",
        data: result.data,
      });

      return decoded as HexAddress;
    } catch (err: unknown) {
      throw new NetworkError({
        code: "FACTORY_QUERY_FAILED",
        message: "Failed to query counterfactual address from factory contract",
        retryable: true,
        debug: { factoryAddress, owner, salt, error: err instanceof Error ? err.message : String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Queries the EntryPoint for the account's current nonce.
   */
  async getNonce(
    entryPoint: HexAddress,
    sender: HexAddress,
    key: bigint = 0n
  ): Promise<bigint> {
    try {
      const data = encodeFunctionData({
        abi: ENTRY_POINT_ABI,
        functionName: "getNonce",
        args: [sender, key],
      });

      const result = await this.client.call({
        to: entryPoint,
        data,
      });

      if (!result.data) {
        return 0n;
      }

      const decoded = decodeFunctionResult({
        abi: ENTRY_POINT_ABI,
        functionName: "getNonce",
        data: result.data,
      });

      return decoded as bigint;
    } catch (err: unknown) {
      throw new NetworkError({
        code: "NONCE_QUERY_FAILED",
        message: `Failed to query nonce for sender ${sender}`,
        retryable: true,
        debug: { entryPoint, sender, error: err instanceof Error ? err.message : String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Queries fee estimates from the node.
   */
  async getGasFees(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    try {
      const fees = await this.client.estimateFeesPerGas();
      return {
        maxFeePerGas: fees.maxFeePerGas ?? 2000000000n,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 1000000000n,
      };
    } catch {
      // Fallback sensible defaults if not supported by mock/local RPC
      return {
        maxFeePerGas: 2000000000n,
        maxPriorityFeePerGas: 1000000000n,
      };
    }
  }
}
