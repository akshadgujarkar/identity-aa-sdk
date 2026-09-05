/**
 * @identity-aa-sdk/core - Paymaster Client & Packing Utilities
 * ERC-4337 v0.7 paymasterAndData encoding/decoding and Paymaster coordination
 */

import { getAddress, isAddress } from "viem";
import type { HexAddress, HexData } from "../../types/account.js";
import { SponsorshipError } from "../../errors/categories.js";

export interface UnpackedPaymasterAndData {
  paymaster: HexAddress;
  paymasterVerificationGasLimit: bigint;
  paymasterPostOpGasLimit: bigint;
  paymasterData: HexData;
}

export interface PaymasterClientOptions {
  paymasterAddress?: HexAddress;
  defaultVerificationGasLimit?: bigint;
  defaultPostOpGasLimit?: bigint;
}

/**
 * Packs ERC-4337 v0.7 paymasterAndData:
 * [paymaster (20 bytes)] [paymasterVerificationGasLimit (16 bytes)] [paymasterPostOpGasLimit (16 bytes)] [paymasterData (dynamic)]
 */
export function packPaymasterAndData(
  paymasterAddress: HexAddress,
  paymasterVerificationGasLimit: bigint,
  paymasterPostOpGasLimit: bigint,
  paymasterData: HexData | string = "0x"
): HexData {
  if (!paymasterAddress || !isAddress(paymasterAddress)) {
    throw new SponsorshipError({
      code: "INVALID_PAYMASTER_ADDRESS",
      message: `Invalid Paymaster address: ${paymasterAddress}`,
      retryable: false,
    });
  }

  const cleanAddr = getAddress(paymasterAddress).slice(2).toLowerCase(); // 40 chars
  const verGasHex = paymasterVerificationGasLimit.toString(16).padStart(32, "0"); // 32 chars (16 bytes)
  const postGasHex = paymasterPostOpGasLimit.toString(16).padStart(32, "0"); // 32 chars (16 bytes)
  const dataHex = paymasterData.startsWith("0x") || paymasterData.startsWith("0X")
    ? paymasterData.slice(2)
    : paymasterData;

  return `0x${cleanAddr}${verGasHex}${postGasHex}${dataHex}` as HexData;
}

/**
 * Unpacks ERC-4337 v0.7 paymasterAndData fields.
 */
export function unpackPaymasterAndData(paymasterAndData: HexData): UnpackedPaymasterAndData {
  if (!paymasterAndData || paymasterAndData === "0x" || paymasterAndData.length < 106) {
    throw new SponsorshipError({
      code: "INVALID_PAYMASTER_DATA_LENGTH",
      message: `paymasterAndData length (${paymasterAndData?.length || 0}) is too short to contain v0.7 static header (minimum 52 bytes / 106 hex chars)`,
      retryable: false,
      debug: { paymasterAndData },
    });
  }

  const raw = paymasterAndData.slice(2);
  const paymasterHex = `0x${raw.slice(0, 40)}`;
  const verGasHex = raw.slice(40, 72);
  const postGasHex = raw.slice(72, 104);
  const dataHex = `0x${raw.slice(104)}`;

  return {
    paymaster: getAddress(paymasterHex) as HexAddress,
    paymasterVerificationGasLimit: BigInt(`0x${verGasHex}`),
    paymasterPostOpGasLimit: BigInt(`0x${postGasHex}`),
    paymasterData: dataHex as HexData,
  };
}

export class PaymasterClient {
  public readonly paymasterAddress?: HexAddress;
  public readonly defaultVerificationGasLimit: bigint;
  public readonly defaultPostOpGasLimit: bigint;

  constructor(options: PaymasterClientOptions = {}) {
    this.paymasterAddress = options.paymasterAddress;
    this.defaultVerificationGasLimit = options.defaultVerificationGasLimit ?? 100_000n;
    this.defaultPostOpGasLimit = options.defaultPostOpGasLimit ?? 50_000n;
  }

  /**
   * Constructs valid ERC-4337 v0.7 paymasterAndData for a UserOperation.
   */
  public generatePaymasterAndData(
    overrides?: Partial<{
      paymasterAddress: HexAddress;
      verificationGasLimit: bigint;
      postOpGasLimit: bigint;
      paymasterData: HexData | string;
    }>
  ): HexData {
    const address = overrides?.paymasterAddress ?? this.paymasterAddress;
    if (!address) {
      throw new SponsorshipError({
        code: "MISSING_PAYMASTER_ADDRESS",
        message: "Cannot attach paymaster sponsorship: no paymasterAddress configured",
        retryable: false,
      });
    }

    const vgl = overrides?.verificationGasLimit ?? this.defaultVerificationGasLimit;
    const pgl = overrides?.postOpGasLimit ?? this.defaultPostOpGasLimit;
    const data = overrides?.paymasterData ?? "0x";

    return packPaymasterAndData(address, vgl, pgl, data);
  }
}
