/**
 * @identity-aa-sdk/clerk
 * Clerk adapter implementing IdentityResolver
 */

import type { IdentityResolver, AppIdentity } from "@identity-aa-sdk/core";

export interface ClerkSessionLike {
  user?: {
    id: string;
    primaryEmailAddress?: { emailAddress: string };
  };
  id: string;
}

export class ClerkIdentityResolver implements IdentityResolver {
  constructor(private readonly getSession: () => ClerkSessionLike | null | undefined) {}

  async resolve(): Promise<AppIdentity> {
    const session = this.getSession();
    if (!session || !session.user) {
      throw new Error("No active Clerk session found");
    }
    return {
      provider: "clerk",
      subjectId: session.user.id,
      email: session.user.primaryEmailAddress?.emailAddress,
    };
  }
}
