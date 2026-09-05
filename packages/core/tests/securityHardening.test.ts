import { describe, it } from "node:test";
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
import {
  translateBundlerError,
  extractAACode,
} from "../src/internal/bundler/errorTranslator.js";
import { InMemoryKeyStore } from "../src/internal/signer/keyStore.js";
import { LocalSigner } from "../src/internal/signer/signer.js";
import { GasPolicyManager } from "../src/internal/gasPolicy/gasPolicy.js";
import { AccountManager } from "../src/internal/accountManager.js";
import { TransactionStateMachine } from "../src/internal/transactionEngine/stateMachine.js";
import type { AppIdentity, TransactionIntent } from "../src/types/index.js";

describe("Phase 11 — Security & Error Hardening (Core SDK)", () => {
  describe("Error Model & AA## Translation Hardening", () => {
    it("extractAACode parses AA codes from error messages, data strings, and payload objects", () => {
      assert.equal(extractAACode("Execution failed with AA23 signature mismatch"), "AA23");
      assert.equal(extractAACode("Revert", "AA33 paymaster rejected"), "AA33");
      assert.equal(extractAACode("Revert", { message: "Error: AA10 initCode failed" }), "AA10");
      assert.equal(extractAACode("Random error without AA code"), undefined);
    });

    it("translates AA10 to AccountError", () => {
      const err10 = translateBundlerError(new Error("RPC error: AA10 initCode failed"));
      assert.equal(err10.category, "AccountError");
      assert.equal(err10.causeCode, "AA10");
    });

    it("translates AA24 to SigningError", () => {
      const err24 = translateBundlerError(new Error("RPC error: AA24 signature error"));
      assert.equal(err24.category, "SigningError");
      assert.equal(err24.causeCode, "AA24");
    });

    it("translates AA31/AA32/AA33/AA34 to SponsorshipError", () => {
      const err31 = translateBundlerError(new Error("RPC error: AA31 paymaster not deployed"));
      assert.equal(err31.category, "SponsorshipError");
      assert.equal(err31.causeCode, "AA31");

      const err32 = translateBundlerError(new Error("RPC error: AA32 paymaster expired"));
      assert.equal(err32.category, "SponsorshipError");
      assert.equal(err32.causeCode, "AA32");

      const err33 = translateBundlerError(new Error("RPC error: AA33 paymaster reverted"));
      assert.equal(err33.category, "SponsorshipError");
      assert.equal(err33.causeCode, "AA33");

      const err34 = translateBundlerError(new Error("RPC error: AA34 paymaster signature failed"));
      assert.equal(err34.category, "SponsorshipError");
      assert.equal(err34.causeCode, "AA34");
    });

    it("translates AA21/AA22/AA23/AA25/AA90 and mempool rejections to BundlerError", () => {
      const err21 = translateBundlerError(new Error("RPC error: AA21 prefund too low"));
      assert.equal(err21.category, "BundlerError");
      assert.equal(err21.causeCode, "AA21");

      const err22 = translateBundlerError(new Error("RPC error: AA22 expired or not due"));
      assert.equal(err22.category, "BundlerError");
      assert.equal(err22.causeCode, "AA22");

      const err23 = translateBundlerError(new Error("RPC error: AA23 reverted in validation"));
      assert.equal(err23.category, "BundlerError");
      assert.equal(err23.causeCode, "AA23");

      const err25 = translateBundlerError(new Error("RPC error: AA25 invalid nonce"));
      assert.equal(err25.category, "BundlerError");
      assert.equal(err25.causeCode, "AA25");

      const err90 = translateBundlerError(new Error("RPC error: AA90 invalid bundle"));
      assert.equal(err90.category, "BundlerError");
      assert.equal(err90.causeCode, "AA90");
    });

    it("translates network timeouts and connection resets to NetworkError", () => {
      const netErr = translateBundlerError(new Error("fetch failed: ECONNREFUSED 127.0.0.1:4337"));
      assert.equal(netErr.category, "NetworkError");
      assert.equal(netErr.retryable, true);
    });

    it("passes through existing SDKError instances untouched", () => {
      const original = new IdentityError({ code: "SESSION_EXPIRED", message: "Clerk expired" });
      const translated = translateBundlerError(original);
      assert.equal(translated, original);
    });
  });

  describe("Key Management & Custody Invariants", () => {
    it("InMemoryKeyStore securely stores and retrieves signer instances per keyId", async () => {
      const keyStore = new InMemoryKeyStore();
      const signerA = LocalSigner.create("signer_alice_001");
      const signerB = LocalSigner.create("signer_bob_002");

      await keyStore.save("signer_alice_001", signerA);
      await keyStore.save("signer_bob_002", signerB);

      const retrievedA = await keyStore.get("signer_alice_001");
      const retrievedB = await keyStore.get("signer_bob_002");
      const nonExistent = await keyStore.get("signer_nonexistent");

      assert.ok(retrievedA);
      assert.ok(retrievedB);
      assert.equal(nonExistent, null);

      assert.equal(await retrievedA.getAddress(), await signerA.getAddress());
      assert.equal(await retrievedB.getAddress(), await signerB.getAddress());
      assert.notEqual(await retrievedA.getAddress(), await retrievedB.getAddress());

      // Signing is distinct and valid
      const data = "0x12345678" as `0x${string}`;
      const sigA = await retrievedA.signHash(data);
      const sigB = await retrievedB.signHash(data);
      assert.ok(sigA.startsWith("0x"));
      assert.ok(sigB.startsWith("0x"));
      assert.notEqual(sigA, sigB);
    });
  });

  describe("Gas Policy & Rate Limiting Hardening", () => {
    it("enforces rate limit windows and denies transactions over threshold", () => {
      const policyManager = new GasPolicyManager({
        type: "conditional",
        fallbackToUnsponsored: true,
        rateLimit: {
          maxTransactions: 2,
          windowSeconds: 60,
        },
      });

      const intent: TransactionIntent = {
        to: "0x1111111111111111111111111111111111111111",
        value: 0n,
      };

      const user = "user_rate_test";
      const decision1 = policyManager.evaluateSponsorship([intent], user);
      assert.equal(decision1.approved, true);

      const decision2 = policyManager.evaluateSponsorship([intent], user);
      assert.equal(decision2.approved, true);

      const decision3 = policyManager.evaluateSponsorship([intent], user);
      assert.equal(decision3.approved, false);
      assert.ok(decision3.reason?.includes("Rate limit"));
    });

    it("enforces contract and method allowlists strictly", () => {
      const allowedContract = "0x2222222222222222222222222222222222222222";
      const policyManager = new GasPolicyManager({
        type: "conditional",
        fallbackToUnsponsored: true,
        allowlist: {
          contracts: [allowedContract],
          methods: ["0x12345678"],
        },
      });

      // Allowed contract + method
      const decisionAllowed = policyManager.evaluateSponsorship([
        {
          to: allowedContract,
          data: "0x12345678abcdef",
        },
      ]);
      assert.equal(decisionAllowed.approved, true);

      // Denied contract
      const decisionBadContract = policyManager.evaluateSponsorship([
        {
          to: "0x3333333333333333333333333333333333333333",
          data: "0x12345678abcdef",
        },
      ]);
      assert.equal(decisionBadContract.approved, false);

      // Denied method selector
      const decisionBadMethod = policyManager.evaluateSponsorship([
        {
          to: allowedContract,
          data: "0x99999999abcdef",
        },
      ]);
      assert.equal(decisionBadMethod.approved, false);
    });
  });

  describe("Transaction State Machine Invariants", () => {
    it("rejects illegal transitions that violate the lifecycle state machine", () => {
      const sm = new TransactionStateMachine();
      assert.equal(sm.state, "Building");

      // Cannot jump from Building straight to Confirmed (transitions to Failed and throws)
      assert.throws(() => sm.transitionTo("Confirmed"), /Invalid state transition/);

      // Fresh state machine for valid progression to terminal Confirmed state
      const validSm = new TransactionStateMachine();
      validSm.transitionTo("Estimating");
      validSm.transitionTo("Signing");
      validSm.transitionTo("Submitting");
      validSm.transitionTo("Pending");
      validSm.transitionTo("Confirmed");

      // Terminal state cannot transition anywhere
      assert.throws(() => validSm.transitionTo("Building"), /Invalid state transition/);
    });
  });
});
