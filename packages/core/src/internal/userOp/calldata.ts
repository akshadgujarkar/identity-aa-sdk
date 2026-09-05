/**
 * @identity-aa-sdk/core - Smart Account Calldata Encoders
 * Specification from docs/SMART_ACCOUNT.md and docs/TRANSACTION_ENGINE.md
 */

import { encodeFunctionData, parseAbi, concat } from "viem";
import type { HexAddress, HexData } from "../../types/account.js";
import type { TransactionIntent } from "../../types/transaction.js";

const SMART_ACCOUNT_ABI = parseAbi([
  "function execute(address target, uint256 value, bytes calldata data) external",
  "function executeBatch((address target, uint256 value, bytes data)[] calldata calls) external",
]);

const FACTORY_ABI = parseAbi([
  "function createAccount(address owner, bytes32 salt) external returns (address)",
]);

/**
 * Encodes a single transaction intent into SmartAccount.execute(target, value, data) calldata.
 */
export function encodeExecuteCalldata(intent: TransactionIntent): HexData {
  const valueBigInt =
    intent.value !== undefined
      ? typeof intent.value === "bigint"
        ? intent.value
        : BigInt(intent.value)
      : 0n;

  const dataHex: HexData =
    intent.data && intent.data !== ""
      ? (intent.data as HexData)
      : "0x";

  return encodeFunctionData({
    abi: SMART_ACCOUNT_ABI,
    functionName: "execute",
    args: [intent.to, valueBigInt, dataHex],
  }) as HexData;
}

/**
 * Encodes an array of transaction intents into SmartAccount.executeBatch(calls) calldata.
 */
export function encodeExecuteBatchCalldata(intents: readonly TransactionIntent[]): HexData {
  const calls = intents.map((intent) => {
    const valueBigInt =
      intent.value !== undefined
        ? typeof intent.value === "bigint"
          ? intent.value
          : BigInt(intent.value)
        : 0n;

    const dataHex: HexData =
      intent.data && intent.data !== ""
        ? (intent.data as HexData)
        : "0x";

    return {
      target: intent.to,
      value: valueBigInt,
      data: dataHex,
    };
  });

  return encodeFunctionData({
    abi: SMART_ACCOUNT_ABI,
    functionName: "executeBatch",
    args: [calls],
  }) as HexData;
}

/**
 * Encodes factory deployment calldata for first-time account initialization (initCode).
 */
export function encodeInitCode(
  factoryAddress: HexAddress,
  owner: HexAddress,
  salt: HexData
): HexData {
  const factoryCalldata = encodeFunctionData({
    abi: FACTORY_ABI,
    functionName: "createAccount",
    args: [owner, salt],
  });

  return concat([factoryAddress, factoryCalldata]) as HexData;
}
