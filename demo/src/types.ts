/**
 * @identity-aa-sdk/demo - Types
 * Specification defined in docs/DEMO_APPLICATION.md and docs/USER_EXPERIENCE.md.
 */

import type { HexAddress } from "@identity-aa-sdk/core";

export interface DemoUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatar?: string;
}

export interface GuestbookEntry {
  readonly id: string;
  readonly authorAddress: string;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly message: string;
  readonly timestamp: number;
  readonly txHash?: string;
  readonly isSponsored: boolean;
}

export interface DemoConfigOptions {
  readonly rpcUrl?: string;
  readonly bundlerUrl?: string;
  readonly paymasterAddress?: HexAddress;
  readonly entryPointAddress?: HexAddress;
  readonly factoryAddress?: HexAddress;
  readonly chainId?: number;
}
