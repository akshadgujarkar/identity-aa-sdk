/**
 * @identity-aa-sdk/core - UserOperation Types and Packing Helpers
 * Specification from ERC-4337 v0.7 and docs/TRANSACTION_ENGINE.md
 */

import { concat, pad, toHex } from "viem";
import type { HexAddress, HexData } from "../../types/account.js";

/**
 * ERC-4337 v0.7 PackedUserOperation struct.
 */
export interface PackedUserOperation {
  sender: HexAddress;
  nonce: bigint;
  initCode: HexData;
  callData: HexData;
  accountGasLimits: HexData;
  preVerificationGas: bigint;
  gasFees: HexData;
  paymasterAndData: HexData;
  signature: HexData;
}

/**
 * Packs verificationGasLimit (16 bytes) and callGasLimit (16 bytes) into a single bytes32.
 */
export function packAccountGasLimits(verificationGasLimit: bigint, callGasLimit: bigint): HexData {
  const vglHex = pad(toHex(verificationGasLimit), { size: 16 });
  const cglHex = pad(toHex(callGasLimit), { size: 16 });
  return concat([vglHex, cglHex]) as HexData;
}

/**
 * Unpacks bytes32 accountGasLimits into verificationGasLimit and callGasLimit.
 */
export function unpackAccountGasLimits(accountGasLimits: HexData): {
  verificationGasLimit: bigint;
  callGasLimit: bigint;
} {
  const hex = accountGasLimits.startsWith("0x") ? accountGasLimits.slice(2) : accountGasLimits;
  const vglHex = `0x${hex.slice(0, 32)}` as const;
  const cglHex = `0x${hex.slice(32, 64)}` as const;
  return {
    verificationGasLimit: BigInt(vglHex),
    callGasLimit: BigInt(cglHex),
  };
}

/**
 * Packs maxPriorityFeePerGas (16 bytes) and maxFeePerGas (16 bytes) into a single bytes32.
 */
export function packGasFees(maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): HexData {
  const prioHex = pad(toHex(maxPriorityFeePerGas), { size: 16 });
  const maxHex = pad(toHex(maxFeePerGas), { size: 16 });
  return concat([prioHex, maxHex]) as HexData;
}

/**
 * Unpacks bytes32 gasFees into maxPriorityFeePerGas and maxFeePerGas.
 */
export function unpackGasFees(gasFees: HexData): {
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
} {
  const hex = gasFees.startsWith("0x") ? gasFees.slice(2) : gasFees;
  const prioHex = `0x${hex.slice(0, 32)}` as const;
  const maxHex = `0x${hex.slice(32, 64)}` as const;
  return {
    maxPriorityFeePerGas: BigInt(prioHex),
    maxFeePerGas: BigInt(maxHex),
  };
}
