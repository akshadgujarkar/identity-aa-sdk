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
}
