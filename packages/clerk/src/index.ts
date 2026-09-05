/**
 * @identity-aa-sdk/clerk
 * Clerk Adapter implementing IdentityResolver for Identity AA SDK.
 * Specifications defined in docs/IDENTITY_ARCHITECTURE.md and docs/phases/PHASE_04_IDENTITY.md.
 */

import { type IdentityResolver, type AppIdentity, IdentityError } from "@identity-aa-sdk/core";

/**
 * Structural type matching Clerk User object shapes.
 */
export interface ClerkUserLike {
  readonly id: string;
  readonly primaryEmailAddress?: { readonly emailAddress: string } | string | null;
  readonly emailAddresses?: ReadonlyArray<{ readonly emailAddress: string }> | null;
}

/**
 * Structural type matching Clerk Session object shapes.
 */
export interface ClerkSessionLike {
  readonly id: string;
  readonly user?: ClerkUserLike | null;
  readonly status?: string;
}

/**
 * Structural type matching Clerk JS / Clerk React root client objects.
 */
export interface ClerkClientLike {
  readonly session?: ClerkSessionLike | null;
  readonly user?: ClerkUserLike | null;
}

/**
 * Flexible input source for Clerk session data.
 * Accepts active session/client objects or synchronous/asynchronous accessor functions.
 */
export type ClerkSessionSource =
  | ClerkSessionLike
  | ClerkClientLike
  | (() =>
      | ClerkSessionLike
      | ClerkClientLike
      | null
      | undefined
      | Promise<ClerkSessionLike | ClerkClientLike | null | undefined>);

export interface ClerkResolverOptions {
  /** Optional application or tenant namespace identifier */
  readonly namespace?: string;
}

/**
 * ClerkIdentityResolver translates an active Clerk authentication session into
 * an AppIdentity value object for deterministic account derivation.
 */
export class ClerkIdentityResolver implements IdentityResolver {
  private readonly source: ClerkSessionSource;
  private readonly options?: ClerkResolverOptions;

  /**
   * @param source Active Clerk session, Clerk client, or getter function.
   * @param options Optional configuration including tenant/app namespace.
   */
  constructor(source: ClerkSessionSource, options?: ClerkResolverOptions) {
    if (!source) {
      throw new IdentityError({
        code: "INVALID_RESOLVER_SOURCE",
        message: "ClerkIdentityResolver requires a valid session source or accessor function",
        retryable: false,
      });
    }
    this.source = source;
    this.options = options;
  }

  /**
   * Resolves the current Clerk session into an AppIdentity tuple.
   * Throws IdentityError if no authenticated session is active.
   */
  async resolve(): Promise<AppIdentity> {
    let resolvedData: ClerkSessionLike | ClerkClientLike | null | undefined;

    try {
      if (typeof this.source === "function") {
        resolvedData = await this.source();
      } else {
        resolvedData = this.source;
      }
    } catch (err: unknown) {
      throw new IdentityError({
        code: "SESSION_ACCESSOR_FAILED",
        message: "Failed to retrieve Clerk authentication session",
        retryable: false,
        debug: { error: err instanceof Error ? err.message : String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }

    if (!resolvedData) {
      throw new IdentityError({
        code: "NO_ACTIVE_SESSION",
        message: "No active Clerk session found. User must be authenticated.",
        retryable: false,
      });
    }

    // Extract user from session object or root client object
    let user: ClerkUserLike | null | undefined = undefined;
    if ("user" in resolvedData && resolvedData.user) {
      user = resolvedData.user;
    } else if ("session" in resolvedData && resolvedData.session?.user) {
      user = resolvedData.session.user;
    }

    if (!user) {
      throw new IdentityError({
        code: "MISSING_USER",
        message: "Clerk session exists but contains no active user information",
        retryable: false,
      });
    }

    const subjectId = user.id?.trim();
    if (!subjectId) {
      throw new IdentityError({
        code: "INVALID_USER_ID",
        message: "Clerk user object does not contain a valid user ID",
        retryable: false,
      });
    }

    // Extract primary email if available
    let email: string | undefined = undefined;
    if (typeof user.primaryEmailAddress === "string") {
      email = user.primaryEmailAddress;
    } else if (user.primaryEmailAddress && typeof user.primaryEmailAddress.emailAddress === "string") {
      email = user.primaryEmailAddress.emailAddress;
    } else if (Array.isArray(user.emailAddresses) && user.emailAddresses.length > 0) {
      email = user.emailAddresses[0]?.emailAddress;
    }

    return {
      provider: "clerk",
      subjectId,
      namespace: this.options?.namespace,
      email,
    };
  }
}
