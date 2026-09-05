import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfig, DEFAULT_LOCAL_NETWORK } from "../src/config/index.js";
import { ConfigurationError } from "../src/errors/index.js";

const VALID_ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const VALID_FACTORY = "0x1111111111111111111111111111111111111111";
const VALID_PAYMASTER = "0x2222222222222222222222222222222222222222";

test("Config - Valid development config parses successfully", () => {
  const config = validateConfig({
    network: DEFAULT_LOCAL_NETWORK,
    clerkPublishableKey: "pk_test_sample123",
  });

  assert.equal(config.environment, "development");
  assert.equal(config.network.chainId, 31337);
  assert.equal(config.network.rpcUrl, "http://127.0.0.1:8545");
  assert.equal(config.network.entryPointAddress, VALID_ENTRY_POINT);
  assert.equal(config.clerkPublishableKey, "pk_test_sample123");
});

test("Config - Valid production config with explicit sponsorship passes", () => {
  const config = validateConfig({
    environment: "production",
    network: {
      chainId: 1,
      rpcUrl: "https://mainnet.infura.io/v3/fake",
      entryPointAddress: VALID_ENTRY_POINT,
      factoryAddress: VALID_FACTORY,
      paymasterAddress: VALID_PAYMASTER,
    },
    sponsorship: {
      type: "conditional",
      allowlist: {
        contracts: [VALID_PAYMASTER],
        methods: ["execute()"],
      },
    },
    clerkPublishableKey: "pk_live_realKey123",
  });

  assert.equal(config.environment, "production");
  assert.equal(config.network.chainId, 1);
  assert.equal(config.sponsorship?.type, "conditional");
});

test("Config - Throws on null or non-object configuration", () => {
  assert.throws(
    () => validateConfig(null),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_CONFIG_OBJECT"
  );
  assert.throws(
    () => validateConfig("invalid"),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_CONFIG_OBJECT"
  );
});

test("Config - Throws on secret key exposure", () => {
  // clerkSecretKey field
  assert.throws(
    () =>
      validateConfig({
        network: DEFAULT_LOCAL_NETWORK,
        clerkSecretKey: "sk_test_secret123",
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "SECRET_KEY_EXPOSURE"
  );

  // sk_... passed in clerkPublishableKey
  assert.throws(
    () =>
      validateConfig({
        network: DEFAULT_LOCAL_NETWORK,
        clerkPublishableKey: "sk_live_secret123",
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "SECRET_KEY_EXPOSURE"
  );
});

test("Config - Throws on invalid environment", () => {
  assert.throws(
    () =>
      validateConfig({
        environment: "staging",
        network: DEFAULT_LOCAL_NETWORK,
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_ENVIRONMENT"
  );
});

test("Config - Throws on missing network object", () => {
  assert.throws(
    () => validateConfig({}),
    (err: unknown) => err instanceof ConfigurationError && err.code === "MISSING_NETWORK_CONFIG"
  );
});

test("Config - Throws on invalid chainId", () => {
  assert.throws(
    () =>
      validateConfig({
        network: { ...DEFAULT_LOCAL_NETWORK, chainId: -1 },
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_CHAIN_ID"
  );

  assert.throws(
    () =>
      validateConfig({
        network: { ...DEFAULT_LOCAL_NETWORK, chainId: 31337.5 },
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_CHAIN_ID"
  );
});

test("Config - Throws on invalid rpcUrl and bundlerUrl", () => {
  assert.throws(
    () =>
      validateConfig({
        network: { ...DEFAULT_LOCAL_NETWORK, rpcUrl: "not-a-url" },
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_RPC_URL"
  );

  assert.throws(
    () =>
      validateConfig({
        network: { ...DEFAULT_LOCAL_NETWORK, bundlerUrl: "ftp://invalid" },
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_BUNDLER_URL"
  );
});

test("Config - Throws on invalid EntryPoint, Factory, and Paymaster addresses", () => {
  // Invalid EntryPoint
  assert.throws(
    () =>
      validateConfig({
        network: { ...DEFAULT_LOCAL_NETWORK, entryPointAddress: "0x123" },
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_ENTRYPOINT_ADDRESS"
  );

  // Invalid Factory
  assert.throws(
    () =>
      validateConfig({
        network: { ...DEFAULT_LOCAL_NETWORK, factoryAddress: "0xinvalidaddress" },
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_FACTORY_ADDRESS"
  );

  // Invalid Paymaster
  assert.throws(
    () =>
      validateConfig({
        network: { ...DEFAULT_LOCAL_NETWORK, paymasterAddress: "not-an-address" },
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_PAYMASTER_ADDRESS"
  );
});

test("Config - Throws on invalid sponsorship policy configuration", () => {
  // Invalid type
  assert.throws(
    () =>
      validateConfig({
        network: DEFAULT_LOCAL_NETWORK,
        sponsorship: { type: "unknown" as any },
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_SPONSORSHIP_TYPE"
  );

  // Conditional missing allowlist items
  assert.throws(
    () =>
      validateConfig({
        network: DEFAULT_LOCAL_NETWORK,
        sponsorship: { type: "conditional", allowlist: { contracts: [] } },
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "MISSING_CONDITIONAL_ALLOWLIST"
  );

  // Conditional invalid contract in allowlist
  assert.throws(
    () =>
      validateConfig({
        network: DEFAULT_LOCAL_NETWORK,
        sponsorship: {
          type: "conditional",
          allowlist: { contracts: ["0xinvalid"] },
        },
      }),
    (err: unknown) => err instanceof ConfigurationError && err.code === "INVALID_ALLOWLIST_ADDRESS"
  );
});

test("Config - Production Fail-Closed Rules", () => {
  // Missing sponsorship policy in production
  assert.throws(
    () =>
      validateConfig({
        environment: "production",
        network: {
          chainId: 1,
          rpcUrl: "https://mainnet.infura.io/v3/fake",
          entryPointAddress: VALID_ENTRY_POINT,
          factoryAddress: VALID_FACTORY,
        },
      }),
    (err: unknown) =>
      err instanceof ConfigurationError && err.code === "PRODUCTION_MISSING_SPONSORSHIP_POLICY"
  );

  // Missing factory address in production
  assert.throws(
    () =>
      validateConfig({
        environment: "production",
        network: {
          chainId: 1,
          rpcUrl: "https://mainnet.infura.io/v3/fake",
          entryPointAddress: VALID_ENTRY_POINT,
        },
        sponsorship: { type: "none" },
      }),
    (err: unknown) =>
      err instanceof ConfigurationError && err.code === "PRODUCTION_MISSING_FACTORY_ADDRESS"
  );
});
