/**
 * @identity-aa-sdk/core - ERC-4337 v0.7 UserOperation Hash Calculation
 * Calculates the EIP-712 struct hash and final UserOp hash according to ERC-4337 v0.7.
 */

import {
  concat,
  encodeAbiParameters,
  keccak256,
  slice,
  size,
  toBytes,
  toHex,
} from "viem";
import type { HexAddress, HexData } from "../../types/account.js";
import type { PackedUserOperation } from "./types.js";

const PACKED_USEROP_TYPEHASH = keccak256(
  toBytes(
    "PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)"
  )
);

const DOMAIN_TYPEHASH = keccak256(
  toBytes(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
  )
);

const PAYMASTER_SIG_MAGIC = "0x22e325a297439656"; // keccak256("PaymasterSignature")[:8]

/**
 * Calculates the keccak256 hash of paymasterAndData for signing, stripping
 * dynamic paymaster signature suffix if present.
 */
export function hashPaymasterAndData(paymasterAndData: HexData): HexData {
  const pmdBytesLen = size(paymasterAndData);
  if (pmdBytesLen < 52 + 10) {
    return keccak256(paymasterAndData);
  }

  const magic = slice(paymasterAndData, pmdBytesLen - 8, pmdBytesLen);
  if (magic.toLowerCase() === PAYMASTER_SIG_MAGIC.toLowerCase()) {
    const lenHex = slice(paymasterAndData, pmdBytesLen - 10, pmdBytesLen - 8);
    const sigLen = parseInt(lenHex, 16);
    if (sigLen <= pmdBytesLen - 52 - 10) {
      const dataWithoutSig = slice(paymasterAndData, 0, pmdBytesLen - sigLen - 10);
      return keccak256(concat([dataWithoutSig, PAYMASTER_SIG_MAGIC as HexData]));
    }
  }

  return keccak256(paymasterAndData);
}

/**
 * Computes the EIP-712 Domain Separator for EntryPoint v0.7.
 */
export function getDomainSeparator(entryPoint: HexAddress, chainId: number): HexData {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        DOMAIN_TYPEHASH,
        keccak256(toBytes("ERC4337")),
        keccak256(toBytes("1")),
        BigInt(chainId),
        entryPoint,
      ]
    )
  ) as HexData;
}

/**
 * Computes the ERC-4337 v0.7 UserOperation hash.
 */
export function getUserOpHash(
  userOp: PackedUserOperation,
  entryPoint: HexAddress,
  chainId: number
): HexData {
  const hashInitCode = keccak256(userOp.initCode);
  const hashCallData = keccak256(userOp.callData);
  const pmdHash = hashPaymasterAndData(userOp.paymasterAndData);

  const structEncoded = encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "address" },
      { type: "uint256" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "uint256" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
    [
      PACKED_USEROP_TYPEHASH,
      userOp.sender,
      userOp.nonce,
      hashInitCode,
      hashCallData,
      userOp.accountGasLimits,
      userOp.preVerificationGas,
      userOp.gasFees,
      pmdHash,
    ]
  );

  const structHash = keccak256(structEncoded);
  const domainSeparator = getDomainSeparator(entryPoint, chainId);

  return keccak256(concat(["0x1901", domainSeparator, structHash])) as HexData;
}
