import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SDKError,
  IdentityError,
  AccountError,
  SigningError,
  TransactionError,
  GasError,
  SponsorshipError,
  BundlerError,
  NetworkError,
  ContractExecutionError,
  ConfigurationError,
} from "../src/errors/index.js";

test("Errors - Base SDKError preserves category, code, message, and error cause", () => {
  const innerError = new Error("Underlying network timeout");
  const err = new SDKError({
    category: "NetworkError",
    code: "RPC_TIMEOUT",
    message: "Network call timed out",
    retryable: true,
    debug: { endpoint: "http://localhost:8545" },
    causeCode: -32000,
    cause: innerError,
  });

  assert.equal(err instanceof Error, true);
  assert.equal(err instanceof SDKError, true);
  assert.equal(err.name, "NetworkError");
  assert.equal(err.category, "NetworkError");
  assert.equal(err.code, "RPC_TIMEOUT");
  assert.equal(err.message, "Network call timed out");
  assert.equal(err.retryable, true);
  assert.equal(err.causeCode, -32000);
  assert.deepEqual(err.debug, { endpoint: "http://localhost:8545" });
  assert.equal(err.cause, innerError);
});

test("Errors - SDKError toJSON serialization", () => {
  const err = new SDKError({
    category: "IdentityError",
    code: "NO_ACTIVE_SESSION",
    message: "User is not logged in",
    retryable: false,
  });

  const json = err.toJSON();
  assert.equal(json.name, "IdentityError");
  assert.equal(json.category, "IdentityError");
  assert.equal(json.code, "NO_ACTIVE_SESSION");
  assert.equal(json.retryable, false);
});

test("Errors - Concrete error classes set respective categories and default retryability", () => {
  const identityErr = new IdentityError({ code: "EXPIRED", message: "Session expired" });
  assert.equal(identityErr instanceof IdentityError, true);
  assert.equal(identityErr instanceof SDKError, true);
  assert.equal(identityErr.category, "IdentityError");
  assert.equal(identityErr.retryable, false);

  const accountErr = new AccountError({ code: "DERIVATION_FAILED", message: "Failed to derive salt" });
  assert.equal(accountErr.category, "AccountError");
  assert.equal(accountErr.retryable, false);

  const signingErr = new SigningError({ code: "KEY_NOT_FOUND", message: "Signer key unavailable" });
  assert.equal(signingErr.category, "SigningError");
  assert.equal(signingErr.retryable, false);

  const txErr = new TransactionError({ code: "SUBMISSION_TIMEOUT", message: "Tx timed out" });
  assert.equal(txErr.category, "TransactionError");
  assert.equal(txErr.retryable, true);

  const gasErr = new GasError({ code: "ESTIMATION_REVERTED", message: "Gas estimation failed" });
  assert.equal(gasErr.category, "GasError");
  assert.equal(gasErr.retryable, true);

  const sponsorshipErr = new SponsorshipError({
    code: "RATE_LIMIT_EXCEEDED",
    message: "Rate limit exceeded for today",
  });
  assert.equal(sponsorshipErr.category, "SponsorshipError");
  assert.equal(sponsorshipErr.retryable, false);

  const bundlerErr = new BundlerError({
    code: "USEROP_REJECTED",
    message: "Bundler mempool rejected op",
    causeCode: "AA21",
  });
  assert.equal(bundlerErr.category, "BundlerError");
  assert.equal(bundlerErr.causeCode, "AA21");
  assert.equal(bundlerErr.retryable, true);

  const networkErr = new NetworkError({ code: "RPC_UNREACHABLE", message: "Node unreachable" });
  assert.equal(networkErr.category, "NetworkError");
  assert.equal(networkErr.retryable, true);

  const contractErr = new ContractExecutionError({
    code: "EXECUTION_REVERTED",
    message: "Target contract reverted",
    debug: { revertReason: "ERC20: transfer amount exceeds balance" },
  });
  assert.equal(contractErr.category, "ContractExecutionError");
  assert.equal(contractErr.retryable, false);

  const configErr = new ConfigurationError({ code: "INVALID_FIELD", message: "Missing field" });
  assert.equal(configErr.category, "ConfigurationError");
  assert.equal(configErr.retryable, false);
});
