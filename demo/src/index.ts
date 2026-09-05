/**
 * @identity-aa-sdk/demo
 * Example demo application showcasing identity-driven Account Abstraction
 * Specifications defined in docs/DEMO_APPLICATION.md and docs/phases/PHASE_10_DEMO.md.
 */

export * from "./types.js";
export * from "./config.js";
export * from "./components/AuthScreen.js";
export * from "./components/AccountCard.js";
export * from "./components/GuestbookForm.js";
export * from "./components/GuestbookList.js";
export * from "./GuestbookApp.js";

// Legacy helper compatibility
import { DEFAULT_LOCAL_NETWORK } from "@identity-aa-sdk/core";

export function getDemoConfig() {
  return {
    network: DEFAULT_LOCAL_NETWORK,
  };
}
