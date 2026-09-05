/**
 * @identity-aa-sdk/react - IdentityAAProvider Component
 * Specifications defined in docs/SDK_ARCHITECTURE.md and docs/phases/PHASE_09_REACT.md.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  type SDKConfig,
  type IdentityResolver,
  type Account,
  type AppIdentity,
  IdentityAASDK,
  createIdentityAASDK,
  type KeyStore,
} from "@identity-aa-sdk/core";
import { IdentityAAContext, type IdentityAAContextValue } from "./context.js";

export interface IdentityAAProviderBaseProps {
  /** Whether to automatically resolve the account on mount (default: true) */
  readonly autoResolve?: boolean;
  /** Optional explicit identity override for resolution */
  readonly identity?: AppIdentity;
  /** Children components */
  readonly children?: React.ReactNode;
}

export interface IdentityAAProviderWithClientProps extends IdentityAAProviderBaseProps {
  /** Pre-instantiated IdentityAASDK client instance */
  readonly client: IdentityAASDK;
  readonly config?: never;
  readonly resolver?: never;
  readonly keyStore?: never;
}

export interface IdentityAAProviderWithConfigProps extends IdentityAAProviderBaseProps {
  readonly client?: never;
  /** SDK configuration object */
  readonly config: SDKConfig;
  /** Identity resolver adapter (e.g. ClerkIdentityResolver) */
  readonly resolver: IdentityResolver;
  /** Optional custom KeyStore */
  readonly keyStore?: KeyStore;
}

export type IdentityAAProviderProps =
  | IdentityAAProviderWithClientProps
  | IdentityAAProviderWithConfigProps;

/**
 * Root context provider for the Identity AA SDK in React applications.
 */
export function IdentityAAProvider({
  config,
  resolver,
  keyStore,
  client: directClient,
  autoResolve = true,
  identity,
  children,
}: IdentityAAProviderProps): React.JSX.Element {
  // Memoize SDK instance so it persists across re-renders unless config/resolver/client changes
  const client = useMemo(() => {
    if (directClient) {
      return directClient;
    }
    if (!config || !resolver) {
      throw new Error(
        "IdentityAAProvider requires either an initialized 'client' or both 'config' and 'resolver' props."
      );
    }
    return createIdentityAASDK({ config, resolver, keyStore });
  }, [directClient, config, resolver, keyStore]);

  const [account, setAccount] = useState<Account | undefined>(undefined);
  const [isLoadingAccount, setIsLoadingAccount] = useState<boolean>(autoResolve);
  const [accountError, setAccountError] = useState<Error | undefined>(undefined);

  // Keep identity ref to avoid stale closure in callbacks
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const refetchAccount = useCallback(async (): Promise<Account | undefined> => {
    setIsLoadingAccount(true);
    setAccountError(undefined);
    try {
      const resolved = await client.getAccount(identityRef.current);
      setAccount(resolved);
      return resolved;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setAccountError(error);
      setAccount(undefined);
      return undefined;
    } finally {
      setIsLoadingAccount(false);
    }
  }, [client]);

  useEffect(() => {
    if (autoResolve) {
      void refetchAccount();
    }
  }, [autoResolve, refetchAccount]);

  const contextValue = useMemo<IdentityAAContextValue>(
    () => ({
      client,
      account,
      isLoadingAccount,
      accountError,
      refetchAccount,
    }),
    [client, account, isLoadingAccount, accountError, refetchAccount]
  );

  return (
    <IdentityAAContext.Provider value={contextValue}>
      {children}
    </IdentityAAContext.Provider>
  );
}
