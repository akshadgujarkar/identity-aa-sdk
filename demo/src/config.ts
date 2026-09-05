/**
 * @identity-aa-sdk/demo - Configuration & Presets
 * Specifications defined in docs/DEMO_APPLICATION.md and docs/SDK_ARCHITECTURE.md.
 */

import {
  DEFAULT_LOCAL_NETWORK,
  type SDKConfig,
} from "@identity-aa-sdk/core";
import { ClerkIdentityResolver } from "@identity-aa-sdk/clerk";
import type { DemoUser, DemoConfigOptions } from "./types.js";

/** Default mock personas for demo authentication */
export const DEMO_USERS: readonly DemoUser[] = [
  {
    id: "user_clerk_alice_001",
    name: "Alice Smith",
    email: "alice@example.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
  },
  {
    id: "user_clerk_bob_002",
    name: "Bob Jones",
    email: "bob@example.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
  },
  {
    id: "user_clerk_charlie_003",
    name: "Charlie Day",
    email: "charlie@example.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie",
  },
] as const;

/**
 * Creates an SDKConfig tailored for the local demo environment.
 */
export function createDemoSDKConfig(options?: DemoConfigOptions): SDKConfig {
  return {
    environment: "development",
    network: {
      chainId: options?.chainId ?? DEFAULT_LOCAL_NETWORK.chainId,
      rpcUrl: options?.rpcUrl ?? DEFAULT_LOCAL_NETWORK.rpcUrl,
      entryPointAddress: options?.entryPointAddress ?? DEFAULT_LOCAL_NETWORK.entryPointAddress,
      factoryAddress: options?.factoryAddress ?? DEFAULT_LOCAL_NETWORK.factoryAddress,
      bundlerUrl: options?.bundlerUrl ?? DEFAULT_LOCAL_NETWORK.bundlerUrl,
      paymasterAddress: options?.paymasterAddress ?? DEFAULT_LOCAL_NETWORK.paymasterAddress,
    },
    sponsorship: {
      type: "full", // 100% gas-sponsored transactions for demo user actions
    },
  };
}

/**
 * Creates a ClerkIdentityResolver for a specific DemoUser.
 */
export function createDemoClerkResolver(user: DemoUser): ClerkIdentityResolver {
  return new ClerkIdentityResolver(() => ({
    id: `session_${user.id}`,
    user: {
      id: user.id,
      primaryEmailAddress: {
        emailAddress: user.email,
      },
      fullName: user.name,
    },
  }));
}
