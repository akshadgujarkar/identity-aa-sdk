import { test } from "node:test";
import assert from "node:assert/strict";
import { IdentityError } from "@identity-aa-sdk/core";
import { ClerkIdentityResolver, ClerkSessionLike, ClerkClientLike } from "../src/index.js";

test("Clerk - Resolves valid session object", async () => {
  const session: ClerkSessionLike = {
    id: "sess_12345",
    user: {
      id: "user_2aBcDeFg",
      primaryEmailAddress: { emailAddress: "alice@example.com" },
    },
  };

  const resolver = new ClerkIdentityResolver(session);
  const identity = await resolver.resolve();

  assert.equal(identity.provider, "clerk");
  assert.equal(identity.subjectId, "user_2aBcDeFg");
  assert.equal(identity.email, "alice@example.com");
  assert.equal(identity.namespace, undefined);
});

test("Clerk - Resolves with custom namespace and string email format", async () => {
  const session: ClerkSessionLike = {
    id: "sess_67890",
    user: {
      id: "user_tenant_1",
      primaryEmailAddress: "bob@company.com",
    },
  };

  const resolver = new ClerkIdentityResolver(session, { namespace: "tenant_corp" });
  const identity = await resolver.resolve();

  assert.equal(identity.provider, "clerk");
  assert.equal(identity.subjectId, "user_tenant_1");
  assert.equal(identity.email, "bob@company.com");
  assert.equal(identity.namespace, "tenant_corp");
});

test("Clerk - Resolves with emailAddresses array fallback", async () => {
  const session: ClerkSessionLike = {
    id: "sess_array",
    user: {
      id: "user_carol",
      emailAddresses: [{ emailAddress: "carol@domain.com" }],
    },
  };

  const resolver = new ClerkIdentityResolver(session);
  const identity = await resolver.resolve();

  assert.equal(identity.provider, "clerk");
  assert.equal(identity.subjectId, "user_carol");
  assert.equal(identity.email, "carol@domain.com");
});

test("Clerk - Resolves via synchronous accessor function", async () => {
  const session: ClerkSessionLike = {
    id: "sess_sync",
    user: { id: "user_sync" },
  };

  const resolver = new ClerkIdentityResolver(() => session);
  const identity = await resolver.resolve();

  assert.equal(identity.provider, "clerk");
  assert.equal(identity.subjectId, "user_sync");
});

test("Clerk - Resolves via asynchronous accessor function", async () => {
  const resolver = new ClerkIdentityResolver(async () => {
    return {
      id: "sess_async",
      user: { id: "user_async" },
    };
  });
  const identity = await resolver.resolve();

  assert.equal(identity.provider, "clerk");
  assert.equal(identity.subjectId, "user_async");
});

test("Clerk - Resolves from root Clerk client shape", async () => {
  const client: ClerkClientLike = {
    session: {
      id: "sess_client",
      user: { id: "user_from_client" },
    },
  };

  const resolver = new ClerkIdentityResolver(client);
  const identity = await resolver.resolve();

  assert.equal(identity.provider, "clerk");
  assert.equal(identity.subjectId, "user_from_client");
});

test("Clerk - Throws on null or invalid constructor source", () => {
  assert.throws(
    () => new ClerkIdentityResolver(null as any),
    (err: unknown) => err instanceof IdentityError && err.code === "INVALID_RESOLVER_SOURCE"
  );
});

test("Clerk - Throws IdentityError when session is null or undefined", async () => {
  const resolver = new ClerkIdentityResolver(() => null);

  await assert.rejects(
    async () => resolver.resolve(),
    (err: unknown) =>
      err instanceof IdentityError &&
      err.category === "IdentityError" &&
      err.code === "NO_ACTIVE_SESSION" &&
      err.retryable === false
  );
});

test("Clerk - Throws IdentityError when session has no user", async () => {
  const resolver = new ClerkIdentityResolver(() => ({ id: "sess_empty", user: null }));

  await assert.rejects(
    async () => resolver.resolve(),
    (err: unknown) => err instanceof IdentityError && err.code === "MISSING_USER"
  );
});

test("Clerk - Throws IdentityError when user ID is empty string", async () => {
  const resolver = new ClerkIdentityResolver(() => ({ id: "sess_blank", user: { id: "   " } }));

  await assert.rejects(
    async () => resolver.resolve(),
    (err: unknown) => err instanceof IdentityError && err.code === "INVALID_USER_ID"
  );
});

test("Clerk - Throws IdentityError when accessor function throws", async () => {
  const resolver = new ClerkIdentityResolver(() => {
    throw new Error("SDK network timeout");
  });

  await assert.rejects(
    async () => resolver.resolve(),
    (err: unknown) =>
      err instanceof IdentityError &&
      err.code === "SESSION_ACCESSOR_FAILED" &&
      err.message.includes("Failed to retrieve Clerk authentication session")
  );
});
