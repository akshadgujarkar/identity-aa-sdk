/**
 * @identity-aa-sdk/core - Configuration Validator
 * Validates SDK configuration and enforces fail-closed production rules.
 */

import { ConfigurationError } from "../errors/categories.js";
import type { HexAddress } from "../types/account.js";
import type { SDKConfig, NetworkConfig, Environment } from "./schema.js";
import type { SponsorshipPolicy } from "../types/sponsorship.js";

const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

function isValidAddress(address: unknown): address is HexAddress {
  return typeof address === "string" && ETH_ADDRESS_REGEX.test(address);
}

function isValidHttpUrl(url: unknown): boolean {
  if (typeof url !== "string" || !url.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates the full SDKConfig object according to fail-closed specification rules.
 * Throws ConfigurationError if validation fails.
 */
export function validateConfig(rawConfig: unknown): SDKConfig {
  if (!rawConfig || typeof rawConfig !== "object") {
    throw new ConfigurationError({
      code: "INVALID_CONFIG_OBJECT",
      message: "Configuration must be a non-null object",
    });
  }

  const config = rawConfig as Record<string, unknown>;

  // Check for forbidden secret keys in client configuration
  if ("clerkSecretKey" in config && config.clerkSecretKey) {
    throw new ConfigurationError({
      code: "SECRET_KEY_EXPOSURE",
      message: "clerkSecretKey must never be supplied in client-side configuration",
    });
  }

  if (typeof config.clerkPublishableKey === "string" && config.clerkPublishableKey.startsWith("sk_")) {
    throw new ConfigurationError({
      code: "SECRET_KEY_EXPOSURE",
      message: "A secret key (sk_...) was supplied in clerkPublishableKey",
    });
  }

  // Validate Environment
  const environment: Environment = (config.environment as Environment) || "development";
  if (!["development", "production", "test"].includes(environment)) {
    throw new ConfigurationError({
      code: "INVALID_ENVIRONMENT",
      message: `Invalid environment '${String(config.environment)}'. Must be 'development', 'production', or 'test'.`,
    });
  }

  // Validate Network
  if (!config.network || typeof config.network !== "object") {
    throw new ConfigurationError({
      code: "MISSING_NETWORK_CONFIG",
      message: "Missing required 'network' configuration object",
    });
  }

  const rawNetwork = config.network as Record<string, unknown>;

  // chainId
  if (typeof rawNetwork.chainId !== "number" || !Number.isInteger(rawNetwork.chainId) || rawNetwork.chainId <= 0) {
    throw new ConfigurationError({
      code: "INVALID_CHAIN_ID",
      message: "network.chainId must be a positive integer",
      debug: { chainId: rawNetwork.chainId },
    });
  }

  // rpcUrl
  if (!isValidHttpUrl(rawNetwork.rpcUrl)) {
    throw new ConfigurationError({
      code: "INVALID_RPC_URL",
      message: "network.rpcUrl must be a valid HTTP or HTTPS URL",
      debug: { rpcUrl: rawNetwork.rpcUrl },
    });
  }

  // bundlerUrl (optional)
  if (rawNetwork.bundlerUrl !== undefined && !isValidHttpUrl(rawNetwork.bundlerUrl)) {
    throw new ConfigurationError({
      code: "INVALID_BUNDLER_URL",
      message: "network.bundlerUrl must be a valid HTTP or HTTPS URL when provided",
      debug: { bundlerUrl: rawNetwork.bundlerUrl },
    });
  }

  // entryPointAddress
  if (!isValidAddress(rawNetwork.entryPointAddress)) {
    throw new ConfigurationError({
      code: "INVALID_ENTRYPOINT_ADDRESS",
      message: "network.entryPointAddress must be a valid 20-byte 0x-prefixed hex address",
      debug: { entryPointAddress: rawNetwork.entryPointAddress },
    });
  }

  // factoryAddress (optional)
  if (rawNetwork.factoryAddress !== undefined && !isValidAddress(rawNetwork.factoryAddress)) {
    throw new ConfigurationError({
      code: "INVALID_FACTORY_ADDRESS",
      message: "network.factoryAddress must be a valid 20-byte 0x-prefixed hex address",
      debug: { factoryAddress: rawNetwork.factoryAddress },
    });
  }

  // paymasterAddress (optional)
  if (rawNetwork.paymasterAddress !== undefined && !isValidAddress(rawNetwork.paymasterAddress)) {
    throw new ConfigurationError({
      code: "INVALID_PAYMASTER_ADDRESS",
      message: "network.paymasterAddress must be a valid 20-byte 0x-prefixed hex address",
      debug: { paymasterAddress: rawNetwork.paymasterAddress },
    });
  }

  const network: NetworkConfig = {
    chainId: rawNetwork.chainId,
    rpcUrl: String(rawNetwork.rpcUrl),
    bundlerUrl: rawNetwork.bundlerUrl ? String(rawNetwork.bundlerUrl) : undefined,
    entryPointAddress: rawNetwork.entryPointAddress,
    factoryAddress: rawNetwork.factoryAddress as HexAddress | undefined,
    paymasterAddress: rawNetwork.paymasterAddress as HexAddress | undefined,
  };

  // Validate Sponsorship
  const rawSponsorship = config.sponsorship as Record<string, unknown> | undefined;
  let sponsorship: SponsorshipPolicy | undefined = undefined;

  if (rawSponsorship !== undefined) {
    if (typeof rawSponsorship !== "object" || rawSponsorship === null) {
      throw new ConfigurationError({
        code: "INVALID_SPONSORSHIP_CONFIG",
        message: "sponsorship must be an object when defined",
      });
    }

    const type = rawSponsorship.type as string;
    if (!["full", "conditional", "none"].includes(type)) {
      throw new ConfigurationError({
        code: "INVALID_SPONSORSHIP_TYPE",
        message: `Invalid sponsorship.type '${type}'. Must be 'full', 'conditional', or 'none'.`,
      });
    }

    if (type === "conditional") {
      const allowlist = rawSponsorship.allowlist as Record<string, unknown> | undefined;
      const contracts = Array.isArray(allowlist?.contracts) ? allowlist.contracts : [];
      const methods = Array.isArray(allowlist?.methods) ? allowlist.methods : [];

      if (contracts.length === 0 && methods.length === 0) {
        throw new ConfigurationError({
          code: "MISSING_CONDITIONAL_ALLOWLIST",
          message: "Conditional sponsorship policy must define at least one contract or method in allowlist",
        });
      }

      for (const contract of contracts) {
        if (!isValidAddress(contract)) {
          throw new ConfigurationError({
            code: "INVALID_ALLOWLIST_ADDRESS",
            message: `Invalid contract address '${String(contract)}' in sponsorship allowlist`,
          });
        }
      }
    }

    sponsorship = rawSponsorship as unknown as SponsorshipPolicy;
  }

  // --- Production Fail-Closed Enforcements ---
  if (environment === "production") {
    if (!sponsorship) {
      throw new ConfigurationError({
        code: "PRODUCTION_MISSING_SPONSORSHIP_POLICY",
        message:
          "Production configuration must specify an explicit sponsorship policy ('full', 'conditional', or 'none'). Fail-closed rule enforced.",
      });
    }

    if (!network.factoryAddress) {
      throw new ConfigurationError({
        code: "PRODUCTION_MISSING_FACTORY_ADDRESS",
        message: "Production configuration requires an explicit network.factoryAddress",
      });
    }
  }

  return {
    environment,
    network,
    sponsorship,
    clerkPublishableKey: config.clerkPublishableKey ? String(config.clerkPublishableKey) : undefined,
  };
}
